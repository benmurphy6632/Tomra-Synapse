from PIL import Image
import requests
import io
import urllib
import base64
import os
from dotenv import load_dotenv

# John - Load environment variables from .env file
load_dotenv()

# Use your own API Key
key_imgbb = os.getenv("IMGBB_Key")

if not key_imgbb:
    print("IMGBB_Key not fixed. Set it using terminal command\n")
    print("setx IMGBB_KEY YOUR_IMGBB_KEY\n")
    print("Find this by creating an imgbb account and finding on https://api.imgbb.com/")

def upload_image_and_get_url(filename):
    # Upload via Imgbb
    with open(filename, "rb") as file:
        url = "https://api.imgbb.com/1/upload"
        payload = {
            "key": key_imgbb,
            "image": base64.b64encode(file.read()),
        }
        res = requests.post(url, data=payload)

        # Check the response
        if res.status_code == 200:
            print("Image Uploaded to Imgbb Successfully")
            json = res.json()
            print(json["data"]["url"])
            return json["data"]["url"]
        else:
            print("Image Upload Failed")
            return None