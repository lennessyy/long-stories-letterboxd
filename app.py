import io
import re
import textwrap
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageDraw, ImageFont

app = Flask(__name__)

STORY_W, STORY_H = 1080, 1920
FONT_DIR = Path(__file__).parent / "static" / "fonts"

SAMPLE_REVIEW = {
    "movie_title": "Fargo",
    "year": "1996",
    "rating": 4.5,
    "backdrop_url": None,
    "review_text": (
        "I'm not sure whether I should watch this, because this movie was only 77% "
        "fresh on Rotten Tomatoes and I usually go for 78% and above overall a well "
        "built on a thoughtfully absurd premise, which made up for its underdeveloped "
        "characters.\n\n"
        "This may be the only time where you see both Minnesotans being the most violent "
        "people in the same film? There were lots of Fargo references, but it's obviously "
        "a very different movie. I don't know, it's thoughtful and convenient to say that "
        "this is what Fargo would have turned out in today's society. The story, after all, "
        "was set in the Reagan era, so whatever riches they had would have inevitably led "
        "to where we are today.\n\n"
        "Bob Odenkirk plays more or less the same character he did in Nobody. Doesn't "
        "mean I mean it negatively — him lobbing explosives on crowds of people somehow "
        "righteously. Lena Headey speaks with a terrific midwestern accent and that terrible "
        "wig, which oddly worked for her. I just felt like both looks like Cersei. I'm just "
        "glad they both made it. Carrie Coon is also having fun.\n\n"
        "Just logged this on letterboxd and got an intimate direct greeting from Bob "
        "Odenkirk saying he is the 'letterboxd person.' why thank you."
    ),
}


def load_font(size, bold=False):
    candidates = [
        FONT_DIR / ("Inter-Bold.ttf" if bold else "Inter-Regular.ttf"),
        FONT_DIR / ("NotoSans-Bold.ttf" if bold else "NotoSans-Regular.ttf"),
    ]
    fallbacks = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates + [Path(p) for p in fallbacks]:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def fetch_backdrop(url: str) -> Image.Image | None:
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception:
        return None


def draw_multiline(draw, text, font, x, y, max_width, fill, line_spacing=1.4):
    """Draw wrapped text, return the y position after last line."""
    words = text.split()
    lines = []
    current = []
    for word in words:
        test = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))

    line_height = font.size * line_spacing
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height
    return y


def draw_star_rating(draw, rating, x, y, size=36):
    """Draw star rating as unicode stars."""
    full = int(rating)
    half = (rating - full) >= 0.5
    empty = 5 - full - (1 if half else 0)
    stars = "★" * full + ("½" if half else "") + "☆" * empty
    font = load_font(size)
    draw.text((x, y), stars, font=font, fill=(255, 220, 100, 255))
    return draw.textbbox((x, y), stars, font=font)


def generate_story_image(review: dict) -> Image.Image:
    img = Image.new("RGBA", (STORY_W, STORY_H), (15, 15, 20, 255))

    # Background: backdrop image with dark overlay
    if review.get("backdrop_url"):
        backdrop = fetch_backdrop(review["backdrop_url"])
        if backdrop:
            # Scale to fill width, crop to story height
            scale = STORY_W / backdrop.width
            new_h = int(backdrop.height * scale)
            backdrop = backdrop.resize((STORY_W, new_h), Image.LANCZOS)
            # Center-crop vertically
            top = max(0, (new_h - STORY_H) // 3)
            backdrop = backdrop.crop((0, top, STORY_W, top + STORY_H))
            img.paste(backdrop, (0, 0))

    # Dark gradient overlay so text is always readable
    overlay = Image.new("RGBA", (STORY_W, STORY_H), (0, 0, 0, 0))
    draw_ov = ImageDraw.Draw(overlay)
    for y in range(STORY_H):
        # Stronger at bottom, lighter at top
        alpha = int(180 + 60 * (y / STORY_H))
        draw_ov.line([(0, y), (STORY_W, y)], fill=(0, 0, 0, alpha))
    img = Image.alpha_composite(img, overlay)

    draw = ImageDraw.Draw(img)

    pad = 72  # horizontal padding
    text_w = STORY_W - pad * 2

    # Movie title + year at top
    title_font = load_font(52, bold=True)
    year_font = load_font(36)
    title = review["movie_title"]
    draw.text((pad, 120), title, font=title_font, fill=(255, 255, 255, 255))
    year_bbox = draw.textbbox((pad, 120), title, font=title_font)
    draw.text((pad, year_bbox[3] + 12), review["year"], font=year_font, fill=(200, 200, 200, 220))

    # Star rating below year
    rating_y = year_bbox[3] + 12 + 36 + 24
    draw_star_rating(draw, review["rating"], pad, rating_y)

    # Divider line
    divider_y = rating_y + 60
    draw.line([(pad, divider_y), (STORY_W - pad, divider_y)], fill=(255, 255, 255, 60), width=1)

    # Review text — auto-size to fill remaining space
    review_text = review["review_text"]
    text_top = divider_y + 48
    text_bottom = STORY_H - 120
    available_h = text_bottom - text_top

    # Try font sizes from largest to smallest until it fits
    for font_size in range(38, 20, -2):
        review_font = load_font(font_size)
        line_height = font_size * 1.5

        # Estimate line count
        words = review_text.split()
        lines = []
        current = []
        for word in words:
            test = " ".join(current + [word])
            bbox = draw.textbbox((0, 0), test, font=review_font)
            if bbox[2] - bbox[0] > text_w and current:
                lines.append(" ".join(current))
                current = [word]
            else:
                current.append(word)
        if current:
            lines.append(" ".join(current))

        # Account for paragraph breaks
        paragraphs = review_text.split("\n\n")
        total_lines = len(lines) + (len(paragraphs) - 1)  # extra gap per paragraph
        total_h = total_lines * line_height

        if total_h <= available_h:
            break

    # Draw review text paragraph by paragraph
    y = text_top
    for i, para in enumerate(review_text.split("\n\n")):
        if i > 0:
            y += line_height * 0.6  # paragraph gap
        y = draw_multiline(draw, para.strip(), review_font, pad, y, text_w,
                           fill=(255, 255, 255, 240), line_spacing=1.5)

    return img.convert("RGB")


def scrape_letterboxd(url: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # Review text
    review_div = soup.select_one(".body-text")
    review_text = ""
    if review_div:
        paragraphs = review_div.find_all("p")
        review_text = "\n\n".join(p.get_text() for p in paragraphs)

    # Movie title + year
    film_link = soup.select_one("meta[property='og:title']")
    og_title = film_link["content"] if film_link else ""
    # og:title is usually "Review of Movie Title (Year) by Username"
    match = re.search(r"Review of (.+?) \((\d{4})\)", og_title)
    movie_title = match.group(1) if match else og_title
    year = match.group(2) if match else ""

    # Star rating
    rating_meta = soup.select_one("meta[name='twitter:data2']")
    rating = 0.0
    if rating_meta:
        rating_text = rating_meta.get("content", "")
        m = re.search(r"([\d.]+) out of 5", rating_text)
        if m:
            rating = float(m.group(1))

    # Backdrop image
    backdrop_url = None
    og_image = soup.select_one("meta[property='og:image']")
    if og_image:
        backdrop_url = og_image["content"]

    return {
        "movie_title": movie_title,
        "year": year,
        "rating": rating,
        "backdrop_url": backdrop_url,
        "review_text": review_text,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/preview", methods=["POST"])
def preview():
    data = request.json
    url = data.get("url", "").strip()

    if url == "__sample__":
        review = SAMPLE_REVIEW
    else:
        try:
            review = scrape_letterboxd(url)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    img = generate_story_image(review)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    buf.seek(0)
    return send_file(buf, mimetype="image/jpeg")


@app.route("/review-data", methods=["POST"])
def review_data():
    data = request.json
    url = data.get("url", "").strip()
    if url == "__sample__":
        return jsonify(SAMPLE_REVIEW)
    try:
        review = scrape_letterboxd(url)
        return jsonify(review)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=5000)
