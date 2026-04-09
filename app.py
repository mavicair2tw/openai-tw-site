from flask import Flask, jsonify, render_template, send_from_directory
import os

app = Flask(__name__)
SAVED_DIR = os.path.join(os.path.dirname(__file__), "saved_images")
os.makedirs(SAVED_DIR, exist_ok=True)


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


if __name__ == "__main__":
    app.run(debug=True)
