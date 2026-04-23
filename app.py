"""
Long Stories for Letterboxd — minimal Flask backend.

Single job: accept a Letterboxd review URL, hit the user's public RSS feed,
extract the matching review, return JSON.

Rendering happens client-side in templates/index.html — no Pillow, no
server-side image generation.
"""
import re
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def parse_review_url(url: str):
    """
    Turn https://letterboxd.com/{user}/film/{slug}/ (optionally with a trailing
    review id) into (user, film_slug).
    """
    path = urlparse(url).path.strip("/").split("/")
    if len(path) < 3 or path[1] != "film":
        raise ValueError("Expected a URL like letterboxd.com/<user>/film/<slug>/")
    return path[0], path[2]


def fetch_backdrop(film_slug: str) -> str | None:
    """Grab the og:image from the public film page."""
    try:
        html = requests.get(f"https://letterboxd.com/film/{film_slug}/", headers=UA, timeout=8).text
        soup = BeautifulSoup(html, "html.parser")
        og = soup.find("meta", property="og:image")
        return og["content"] if og and og.get("content") else None
    except Exception:
        return None


def scrape_from_rss(user: str, film_slug: str) -> dict | None:
    """Try the RSS feed first — fast and reliable for recent reviews."""
    feed = feedparser.parse(f"https://letterboxd.com/{user}/rss/")
    if feed.bozo and not feed.entries:
        return None

    entry = next(
        (e for e in feed.entries if f"/film/{film_slug}/" in e.get("link", "")),
        None,
    )
    if entry is None:
        return None

    soup = BeautifulSoup(entry.get("description", ""), "html.parser")
    for img in soup.find_all("img"):
        img.decompose()
    review_text = soup.get_text("\n\n", strip=True)
    review_text = re.sub(r"^Watched on .*?\n+", "", review_text, flags=re.I)

    rating = entry.get("letterboxd_memberrating") or entry.get("lb_memberrating") or ""
    try:
        rating = float(rating)
    except (TypeError, ValueError):
        rating = 0.0

    title_raw = entry.get("letterboxd_filmtitle") or entry.get("title", "")
    year = entry.get("letterboxd_filmyear") or ""
    if not year:
        m = re.search(r",\s*(\d{4})", title_raw)
        year = m.group(1) if m else ""
    movie_title = re.sub(r",\s*\d{4}.*$", "", title_raw).strip()

    return {
        "movie_title": movie_title,
        "year": str(year),
        "rating": rating,
        "review_text": review_text,
        "backdrop_url": fetch_backdrop(film_slug),
        "reviewer_handle": user,
    }


def scrape_from_page(url: str, user: str, film_slug: str) -> dict:
    """Fallback: scrape the review page directly for older reviews not in RSS."""
    resp = requests.get(url, headers=UA, timeout=10)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Review body lives in .review .body-text or the og:description
    body_el = soup.select_one(".review .body-text, .body-text")
    if body_el:
        review_text = "\n\n".join(p.get_text() for p in body_el.find_all("p"))
    else:
        og_desc = soup.find("meta", property="og:description")
        review_text = og_desc["content"] if og_desc and og_desc.get("content") else ""

    # Rating: look for the star span class pattern (e.g. "rated-8" = 4 stars)
    rating = 0.0
    rating_el = soup.select_one(".rating")
    if rating_el:
        classes = " ".join(rating_el.get("class", []))
        m = re.search(r"rated-(\d+)", classes)
        if m:
            rating = int(m.group(1)) / 2.0

    # Title + year from the film header or og:title
    movie_title = ""
    year = ""
    film_link = soup.select_one("h1.film-title a, .film-title-wrapper a")
    if film_link:
        movie_title = film_link.get_text(strip=True)
    year_el = soup.select_one(".film-title-wrapper small a, h1.film-title small")
    if year_el:
        year = year_el.get_text(strip=True)

    if not movie_title:
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            raw = og_title["content"]
            m = re.match(r"(.+?)(?:\s*\((\d{4})\))?(?:\s*[-–].*)?$", raw)
            if m:
                movie_title = m.group(1).strip()
                year = year or (m.group(2) or "")

    return {
        "movie_title": movie_title,
        "year": str(year),
        "rating": rating,
        "review_text": review_text,
        "backdrop_url": fetch_backdrop(film_slug),
        "reviewer_handle": user,
    }


def resolve_url(url: str) -> str:
    """Follow redirects so short links like boxd.it resolve to canonical URLs."""
    if "letterboxd.com" not in url:
        url = requests.head(url, allow_redirects=True, timeout=10, headers=UA).url
    return url


def scrape_letterboxd(url: str) -> dict:
    url = resolve_url(url)
    user, film_slug = parse_review_url(url)

    result = scrape_from_rss(user, film_slug)
    if result is None:
        result = scrape_from_page(url, user, film_slug)

    if not result.get("review_text"):
        raise RuntimeError("Could not find review text — the review may not exist or the page structure changed")

    result["source_url"] = url
    return result


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/image-proxy")
def image_proxy():
    """Proxy external images to avoid CORS tainting the canvas."""
    img_url = request.args.get("url", "")
    if not img_url or "letterboxd" not in img_url and "ltrbxd" not in img_url:
        return "Forbidden", 403
    try:
        resp = requests.get(img_url, headers=UA, timeout=10)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        return resp.content, 200, {"Content-Type": content_type, "Cache-Control": "public, max-age=86400"}
    except Exception:
        return "Image fetch failed", 502


@app.route("/review-data", methods=["POST"])
def review_data():
    url = (request.get_json(silent=True) or {}).get("url", "").strip()
    if not url:
        return jsonify({"error": "Missing url"}), 400
    try:
        return jsonify(scrape_letterboxd(url))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Scrape failed: {e}"}), 502


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
