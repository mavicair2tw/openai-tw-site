import base64
import os
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_from_directory
from google import genai
from google.genai.errors import APIError

load_dotenv()

app = Flask(__name__)
SAVED_DIR = os.path.join(os.path.dirname(__file__), "saved_images")
os.makedirs(SAVED_DIR, exist_ok=True)

try:
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    print(f"Error initializing Gemini Client: {e}")
    gemini_client = None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/images", methods=["GET"])
def list_images():
    images = []
    for name in sorted(os.listdir(SAVED_DIR), reverse=True):
        if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            stem, _ = os.path.splitext(name)
            prompt_file = os.path.join(SAVED_DIR, f"{stem}.txt")
            prompt_text = ""
            if os.path.exists(prompt_file):
                with open(prompt_file, "r", encoding="utf-8") as f:
                    prompt_text = f.read()
            images.append({"file": name, "prompt": prompt_text})
    return jsonify({"success": True, "images": images})


@app.route("/saved_images/<path:filename>")
def saved_image_file(filename):
    return send_from_directory(SAVED_DIR, filename)


@app.route("/models", methods=["GET"])
def list_models():
    if gemini_client is None:
        return jsonify({"error": "API client not initialized. Check your .env file."}), 500

    try:
        models = []
        for model in gemini_client.models.list():
            models.append(
                {
                    "name": getattr(model, "name", None),
                    "display_name": getattr(model, "display_name", None),
                    "supported_actions": getattr(model, "supported_actions", None),
                }
            )
        return jsonify({"success": True, "models": models})
    except Exception as e:
        return jsonify({"error": f"Could not list models: {str(e)}"}), 500


@app.route("/generate_image", methods=["POST"])
def generate_image():
    if gemini_client is None:
        return jsonify({"error": "API client not initialized. Check your .env file."}), 500

    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt", "").strip()
    aspect_ratio = data.get("aspect_ratio", "1:1")

    if not prompt:
        return jsonify({"error": "Please enter a prompt to generate an image."}), 400

    model_candidates = [
        "models/imagen-4.0-generate-001",
        "models/imagen-4.0-fast-generate-001",
        "models/gemini-2.5-flash-image",
    ]

    last_error = None
    for model_name in model_candidates:
        try:
            result = gemini_client.models.generate_images(
                model=model_name,
                prompt=prompt,
                config={
                    "number_of_images": 1,
                    "output_mime_type": "image/png",
                    "aspect_ratio": aspect_ratio,
                },
            )

            if result.generated_images and result.generated_images[0].image:
                image_bytes = result.generated_images[0].image.image_bytes
                base64_image = base64.b64encode(image_bytes).decode("utf-8")

                stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                image_name = f"image-{stamp}.png"
                prompt_name = f"image-{stamp}.txt"
                image_path = os.path.join(SAVED_DIR, image_name)
                prompt_path = os.path.join(SAVED_DIR, prompt_name)

                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                with open(prompt_path, "w", encoding="utf-8") as f:
                    f.write(f"prompt: {prompt}\nmodel: {model_name}\naspect_ratio: {aspect_ratio}\n")

                return jsonify(
                    {
                        "success": True,
                        "model": model_name,
                        "saved_image": image_name,
                        "image_data": base64_image,
                        "mime_type": "image/png",
                    }
                )

            last_error = f"{model_name}: The API returned no image data."
        except APIError as e:
            last_error = f"{model_name}: {e.message}"
        except Exception as e:
            last_error = f"{model_name}: {str(e)}"

    return jsonify({"error": f"Google API Error: {last_error}"}), 503


if __name__ == "__main__":
    app.run(debug=True)
