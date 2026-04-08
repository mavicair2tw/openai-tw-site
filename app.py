import base64
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from google import genai
from google.genai.errors import APIError

load_dotenv()

app = Flask(__name__)

try:
    gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
except Exception as e:
    print(f"Error initializing Gemini Client: {e}")
    gemini_client = None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/generate_image", methods=["POST"])
def generate_image():
    if gemini_client is None:
        return jsonify({"error": "API client not initialized. Check your .env file."}), 500

    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt", "").strip()

    if not prompt:
        return jsonify({"error": "Please enter a prompt to generate an image."}), 400

    try:
        result = gemini_client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config={
                "number_of_images": 1,
                "output_mime_type": "image/png",
                "aspect_ratio": "1:1",
            },
        )

        if result.generated_images and result.generated_images[0].image:
            image_bytes = result.generated_images[0].image.image_bytes
            base64_image = base64.b64encode(image_bytes).decode("utf-8")

            return jsonify(
                {
                    "success": True,
                    "image_data": base64_image,
                    "mime_type": "image/png",
                }
            )

        return jsonify({"error": "The API returned no image data."}), 500

    except APIError as e:
        print(f"Google API Error: {e}")
        return jsonify({"error": f"Google API Error: {e.message}"}), 503
    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
