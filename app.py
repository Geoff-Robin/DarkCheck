from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Use the quantized dark pattern model
MODEL_PATH = "asquirous/bert-base-uncased-dark_patterns"
tokenizer = None
model = None

def load_model():
    """Load the quantized model for dark pattern detection"""
    global tokenizer, model
    if tokenizer is None or model is None:
        logger.info("Loading model and tokenizer...")
        try:
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
            model.eval()  # Set model to evaluation mode
            logger.info("✅ Model and tokenizer loaded successfully!")
        except Exception as e:
            logger.error(f"❌ Error loading model: {str(e)}")
            raise

def predict_dark_pattern(text):
    """Predict if text contains dark patterns using the quantized model"""
    try:
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            outputs = model(**inputs)
            probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
            dark_pattern_prob = probabilities[0][1].item()  # Probability of dark pattern
            
        return {
            "probability": dark_pattern_prob,
            "is_dark_pattern": dark_pattern_prob > 0.5,
            "confidence": dark_pattern_prob
        }
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return None

@app.route('/analyze', methods=['POST'])
def analyze_text():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = data['text']
        url = data.get('url', '')
        
        logger.info(f"Analyzing text from {url}: {text}")

        # Ensure model is loaded
        if tokenizer is None or model is None:
            load_model()

        prediction = predict_dark_pattern(text)
        if prediction is None:
            raise Exception("Failed to get prediction")

        return jsonify({
            "text": text,
            "url": url,
            "probability": prediction["probability"],
            "is_dark_pattern": prediction["is_dark_pattern"],
            "confidence": prediction["confidence"]
        })

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({
            "error": "Internal server error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    print("🚀 Starting Dark Pattern Detection API...")
    try:
        load_model()
    except Exception as e:
        print(f"❌ Failed to load model at startup: {str(e)}")
    
    app.run(host='0.0.0.0', port=5000, debug=False)