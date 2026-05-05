import sys
from flask import Flask, render_template, abort, request
from flask_mail import Mail, Message
from os import urandom, getenv
from base64 import b64encode
import telebot
import requests

try:
    import orjson
except (ImportError, ModuleNotFoundError):
    import json as orjson
import redis
import re
from datetime import datetime
from threading import Thread
from logging.config import dictConfig

API_URL = getenv("API_URL", "https://admin.ahdesign.website/api/")
REDIS_HOST = getenv("REDIS_HOST")
REDIS_PORT = int(getenv("REDIS_PORT", 6379))
EMAIL_USERNAME = getenv("EMAIL_USERNAME")
EMAIL_PASSWORD = getenv('EMAIL_PASSWORD')
TOKEN = getenv("TELEBOT_TOKEN")
CHAT_ID = getenv("TELEBOT_CHAT_ID")
SITE_KEY = getenv("RECAPTCHA_SITE_KEY")
RECAPTCHA_PRIVATE_KEY = getenv("RECAPTCHA_PRIVATE_KEY")
CLOUDFLARE_TOKEN = getenv("CLOUDFLARE_TOKEN")

dictConfig({
    'version': 1,
    'loggers': {
        '': {  # root logger
            'level': 'NOTSET',
            'handlers': ['debug_console_handler', 'info_rotating_file_handler', 'error_file_handler', 'critical_mail_handler'],
        },
        'my.package': {
            'level': 'WARNING',
            'propagate': False,
            'handlers': ['info_rotating_file_handler', 'error_file_handler' ],
        },
    },
    'handlers': {
        'debug_console_handler': {
            'level': 'DEBUG',
            'formatter': 'info',
            'class': 'logging.StreamHandler',
            'stream': 'ext://sys.stdout',
        },
        'info_rotating_file_handler': {
            'level': 'INFO',
            'formatter': 'info',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'info.log',
            'mode': 'a',
            'maxBytes': 1048576,
            'backupCount': 10
        },
        'error_file_handler': {
            'level': 'WARNING',
            'formatter': 'error',
            'class': 'logging.FileHandler',
            'filename': 'error.log',
            'mode': 'a',
        },
        'critical_mail_handler': {
            'level': 'CRITICAL',
            'formatter': 'error',
            'class': 'logging.handlers.SMTPHandler',
            'mailhost': ('smtp.gmail.com', 587),
            'credentials': (EMAIL_USERNAME, EMAIL_PASSWORD),
            'fromaddr': 'donotreply@ahdesign.website',
            'toaddrs': ['***REDACTED-OLD-RECIPIENT-EMAIL***',
                        '***REDACTED-OLD-SMTP-USER-EMAIL***'],
            'subject': 'Critical error with AH frontend'
        }
    },
    'formatters': {
        'info': {
            'format': '%(asctime)s-%(levelname)s-%(name)s::%(module)s|%(lineno)s:: %(message)s'
        },
        'error': {
            'format': '%(asctime)s-%(levelname)s-%(name)s-%(process)d::%(module)s|%(lineno)s:: %(message)s'
        },
    },

})

HOOK_SECRET = getenv("HOOK_SECRET")
app = Flask(__name__)
at = [SITE_KEY, RECAPTCHA_PRIVATE_KEY, TOKEN, CHAT_ID, EMAIL_PASSWORD, EMAIL_USERNAME]
if any(not bool(i) for i in at):
    app.logger.error("one of the environment is None.")
    sys.exit(1)
app.secret_key = b64encode(urandom(64)).decode('utf-8')
mail_settings = {
    "MAIL_SERVER": 'smtp.gmail.com',
    "MAIL_PORT": 587,
    "MAIL_USE_SSL": False,
    "MAIL_USE_TLS": True,
    "MAIL_USERNAME": EMAIL_USERNAME,
    "MAIL_PASSWORD": EMAIL_PASSWORD
}
app.config.update(mail_settings)
mail = Mail(app)
# Telebot token
bot = telebot.TeleBot(TOKEN, parse_mode="Html")
# captcha tokens
REDIS_OBJECT = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True, db=1)

if not REDIS_OBJECT.ping():
    print("OOOoooooOOO000OOOO")
    sys.exit(1)


def is_human(captcha_response):
    payload = {"response": captcha_response, "secret": RECAPTCHA_PRIVATE_KEY}
    response = requests.post(
        "https://www.google.com/recaptcha/api/siteverify", data=payload
    )
    response_text = orjson.loads(response.text)
    return response_text["success"]


def sender(body):
    with app.app_context():
        msg = Message(
            subject=body.get('subject'),
            sender='donotreply@ahdesign.website',
            recipients=['***REDACTED-OLD-RECIPIENT-EMAIL***',
                        '***REDACTED-OLD-SMTP-USER-EMAIL***'],
            body=body.get('body')
        )
        mail.send(msg)

    return


def sendclient(name, email):
    with app.app_context():
        msgc = Message(
            subject='ContactForm',
            sender='donotreply@ahdesign.website',
            recipients=[email],
            html=render_template('mail.html', name=name)
        )
        mail.send(msgc)
    return


@app.errorhandler(404)
def page_not_found(error):
    return render_template('404.html'), 404


def cloudflare_clear():
    headers = {
        "Authorization": f'Bearer {CLOUDFLARE_TOKEN}',
        "Content-Type": "application/json",
    }

    data = '{"purge_everything":true}'

    r = requests.post(
        "https://api.cloudflare.com/client/v4/zones/c78c4744f15e4ab5cd18e3a7cf1ba930/purge_cache",
        headers=headers,
        data=data,
    )

    if r.status_code != 200:
        app.logger.error("cloudflare cache couldn't be cleared res: --> \t"  + str(r.content))
        return False

    return True


def req(path):
    headers = {'User-Agent':
                   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36'}
    res = requests.get(API_URL + path, headers=headers)
    if res.status_code == 200 and hasattr(res, "json"):
        REDIS_OBJECT.set(path, res.content)

        return True
    app.logger.error("Couldn't get the data for " + path)
    raise Exception("Couldn't get the data for " + path)


def data_getter():
    paths = ["posts", "categories", "authors"]
    thrs = [Thread(target=req, args=(i,)) for i in paths]
    for th in thrs:
        th.start()

    del th
    for th in thrs:
        th.join()

    authors = orjson.loads(REDIS_OBJECT.get("authors"))
    categories = orjson.loads(REDIS_OBJECT.get("categories"))
    posts = orjson.loads(REDIS_OBJECT.get("posts"))

    def get_category(category_id):
        for cate in categories:
            if cate.get("id") == category_id:
                if cate.get("count") is None:
                    cate["count"] = 1
                else:
                    cate["count"] += 1
                return cate

    author_medias = ["pic", "webp_pic"]

    def get_author(category_id):
        for author in authors:
            if author.get("id") == category_id:
                if not author[author_medias[-1]].startswith("https"):
                    for media in author_medias:
                        author[media] = "https://admin.ahdesign.website/media/" + author[media]
                    del media
                return author

    medias = ["thumbnail", "pic", "webp_pic"]
    draft_posts = []
    if all([authors, categories, posts]):
        for post in posts[:]:
            post['category'] = get_category(post.get("category_id"))
            del post["category_id"]
            post['author'] = get_author(post.get("author_id"))
            del post["author_id"]
            for media in medias:
                post[media] = "https://admin.ahdesign.website/media/" + post[media]
            d = datetime.strptime(post["published_date"].replace("T", " ").rstrip("Z"), '%Y-%m-%d %H:%M:%S')

            post["published_date"] = f"{d.day} {d.strftime('%b')}, {d.year}"
            post["published_date_day"] = d.day
            post["published_date_month"] = d.strftime('%b')
            if post.get("draft"):
                draft_posts.append(post)
                posts.remove(post)

        REDIS_OBJECT.set("posts", orjson.dumps(posts))
        REDIS_OBJECT.set("draft_posts", orjson.dumps(draft_posts))
        all_categories_count = 0
        for cate in categories:
            all_categories_count += cate.get("count")
        REDIS_OBJECT.set("categories", orjson.dumps(categories))
        REDIS_OBJECT.set("all_categories_count", str(all_categories_count))
        Thread(target=cloudflare_clear).start()
        return True
    app.logger.error("couldn't load posts")
    raise Exception("couldn't load posts")


@app.route("/hook", methods=["GET", "HEAD"])
def hook():
    if request.method == "HEAD":
        if not HOOK_SECRET:
            app.logger.error("HOOK_SECRET not configured; refusing hook auth")
            return 'Unauthorized', 401
        auth = request.headers.get('Authorization', None)
        if auth is None or auth != f'Bearer {HOOK_SECRET}':
            return 'Unauthorized', 401
        Thread(target=data_getter).start()
        return '', 204
    abort(404)


@app.route('/')
def router():
    rp = orjson.loads(REDIS_OBJECT.get("posts"))[:3]
    return render_template('index.html', recent_posts=rp)


def find_urls_in_string(string):
    regex = r"((?:(https?|s?ftp):\/\/)?(?:www\.)?((?:(?:[A-Za-z0-9][A-Za-z0-9-]{0,61}[A-Za-z0-9]\.)+)([A-Za-z]{2,6})|(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))(?::(\d{1,8}))?(?:(\/\S+)*))"
    urls = re.findall(regex, string)
    return [x[0] for x in urls]


@app.route('/<page>', methods=["POST", "GET"])
def page_handler(page):
    pages = ['about-us', 'ads-service', 'contact', 'order', 'price',
             'projects', 'services', 'web_development', ]
    forms = ['order', 'contact']
    if request.method == "POST" and page in forms:
        captcha_response = request.form.get("g-recaptcha-response")
        if captcha_response is None or not is_human(captcha_response):
            # Thread(target=contact_failed, args=(request, "wrong_captcha")).start()
            abort(403)
        form_name = 'Order' if 'plan' in request.form.keys() else 'Contact'
        subject = f"New {form_name}Form"
        keys = ['name', 'email', 'phone', 'company', 'title', 'message']
        msg = ''
        for k, v in request.form.items():
            if k == "recaptcha-v3-token":
                app.logger.warning("recaptcha-v3-token found")
            if k in keys:
                url_chck = find_urls_in_string(v)
                if k != "email" and bool(url_chck):
                    abort(403)
                msg += k + " = " + v + '\n'
        telegram_msg = f"{subject}\n" + msg
        bot.send_message(CHAT_ID, telegram_msg)
        sender({"subject": subject, "body": msg})
        # sendclient(name, email)
        return {"success": "true"}
    if page == "blog":
        posts = orjson.loads(REDIS_OBJECT.get("posts"))
        return render_template("blog.html", posts=posts)
    if page in pages:
        return render_template(f'{page}.html', site_key=SITE_KEY)

    abort(404)


@app.route("/category/<slug>")
def category(slug):
    categories = orjson.loads(REDIS_OBJECT.get("categories"))
    posts = orjson.loads(REDIS_OBJECT.get("posts"))
    page_posts = []
    for post in posts:
        if post.get("category").get("slug") == slug:
            page_posts.append(post)

    return render_template('blog.html', posts=page_posts, categories=categories)


@app.route("/author/<int:author_id>")
def author(author_id):
    categories = orjson.loads(REDIS_OBJECT.get("categories"))
    posts = orjson.loads(REDIS_OBJECT.get("posts"))
    page_posts = []
    for post in posts:
        if post.get("author").get("id") == int(author_id):
            page_posts.append(post)

    return render_template('blog.html', posts=page_posts, categories=categories)


@app.route("/draft/<slug>")
def draft(slug):
    categories = orjson.loads(REDIS_OBJECT.get("categories"))
    posts = orjson.loads(REDIS_OBJECT.get("draft_posts"))
    all_categories_count = REDIS_OBJECT.get("all_categories_count")
    for post in posts:
        if post.get("slug") == slug:
            return render_template("single-post.html", post=post, categories=categories, posts=posts,
                                   all_categories_count=all_categories_count)
    abort(404)


@app.route("/post/<slug>")
def post(slug):
    categories = orjson.loads(REDIS_OBJECT.get("categories"))
    posts = orjson.loads(REDIS_OBJECT.get("posts"))
    all_categories_count = REDIS_OBJECT.get("all_categories_count")
    for post in posts:
        if post.get("slug") == slug:
            return render_template("single-post.html", post=post, categories=categories, posts=posts,
                                   all_categories_count=all_categories_count)
    abort(404)


data_getter()
if __name__ == "__main__":
    app.run('127.0.0.1', debug=True, port=8080)
