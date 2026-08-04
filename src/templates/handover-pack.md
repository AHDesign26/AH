# Handover pack: {{CLIENT_NAME}}

Everything you own, where it lives, and how to use it without us.

Filled in and delivered at launch. Keep it somewhere you can find it again. If
you ever hire another developer, this document is what you hand them.

- **Site:** {{SITE_URL}}
- **Launched:** {{LAUNCH_DATE}}
- **Package:** {{PACKAGE}}
- **Prepared by:** AH Design, info@ahdesign.website, (+359) 88 666 0034

---

## 1. Your domain

| | |
|---|---|
| Domain | {{DOMAIN}} |
| Registrar | {{REGISTRAR}} |
| Account email | {{REGISTRAR_ACCOUNT_EMAIL}} |
| Renewal date | {{DOMAIN_RENEWAL_DATE}} |
| Annual cost | {{DOMAIN_ANNUAL_COST}} |

The domain is registered in your name, on your card. We are not listed as the
owner and we cannot transfer it away from you.

**This renews every year and it is the one bill that does not go away.** If the
card on the registrar account expires, the domain lapses and the site goes
offline. Put the renewal date in your calendar.

## 2. Your hosting

| | |
|---|---|
| Provider | Cloudflare Pages |
| Account email | {{CLOUDFLARE_ACCOUNT_EMAIL}} |
| Project name | {{CLOUDFLARE_PROJECT}} |
| Cost | Free tier, see section 6 |

The account is yours. We have access only for as long as you want us to have it,
and you can remove us at any time from the Cloudflare dashboard under Manage
Account, Members.

**How a deploy happens.** Pushing a commit to the `main` branch of your
repository triggers a build. Cloudflare pulls the code, runs `npm run build`,
and publishes the result. It takes about a minute. If a build fails the previous
version stays up, so a bad deploy cannot take the site down.

## 3. Your code

| | |
|---|---|
| Repository | {{REPO_URL}} |
| Owner account | {{REPO_OWNER}} |

**The stack.** The site is built with [Astro](https://astro.build), a static
site generator. Your pages are written in `.astro` files, which are HTML with a
small amount of templating. There is no database and no server application. The
build turns everything into plain HTML, CSS and JavaScript files, which is why
the site loads instantly and why there is nothing to hack or patch.

**Running it on your own machine:**

```
git clone {{REPO_URL}}
cd {{REPO_DIR}}
npm install
npm run dev
```

That serves the site at `http://localhost:4321` with live reload.
`npm run build` writes the finished site to `dist/`.

## 4. Your contact form

| | |
|---|---|
| Submissions go to | {{FORM_RECIPIENT_EMAIL}} |
| Spam filtering | Cloudflare Turnstile, honeypot field, URL detection |

The form runs as a Cloudflare Worker. When someone submits it, the Worker checks
the anti-spam token and emails you the contents.

**If submissions stop arriving:** check the spam folder first, then confirm the
recipient address in section 4 still works. If both look fine, the Worker log in
the Cloudflare dashboard under Workers, Logs will show whether the request
arrived. Send us the error and we will fix it.

## 5. Your email

| | |
|---|---|
| Addresses | {{EMAIL_ADDRESSES}} |
| Routed to | {{EMAIL_DESTINATION}} |
| Method | Cloudflare Email Routing |

Mail sent to your custom-domain address is forwarded to the inbox above. You
reply from that inbox.

**What breaks it:** changing the MX records on your domain, or deleting the
destination address without updating the route. If you move the domain to
another registrar, the routing has to be set up again at the new one.

## 6. What is free and what is not

**Free, and expected to stay free:**

- Static hosting on Cloudflare Pages, under its fair-use policy.
- The contact form Worker, within the free request allowance.
- Email routing and forwarding.

**Not free:**

- **Your domain renewal, {{DOMAIN_ANNUAL_COST}} a year.** This is the only
  recurring cost of running your site.

**The honest caveat.** Cloudflare's free tier is a fair-use policy, not a
contract, and no one can promise it will exist unchanged forever. It has been
free for years and we expect it to stay that way. If it ever changes, your site
is standard Astro output and moves to any static host, several of which are also
free. Section 8 says how. This is precisely why we build in a portable way
rather than on a platform that owns your content.

## 7. Limits of this build

Static hosting is the right tool for a brochure or marketing site. Here is where
it stops being the right tool:

| | |
|---|---|
| Traffic | Comfortable into the hundreds of thousands of visits a month |
| Form submissions | Fine up to roughly 100,000 requests a day |
| Email forwarding | Subject to Cloudflare's routing limits, ample for normal business volume |

**You would outgrow this if** you start taking payments on the site, need to
manage stock, want customer accounts and logins, or need content that changes
several times a day from multiple editors. At that point you want a real
application and a database, and we will tell you so rather than stretch a static
site past what it does well.

## 8. If you ever want to leave us

You do not need our permission and you do not need to ask. Everything is
already in your accounts.

Hand another developer this list:

1. The repository URL in section 3. The code is standard Astro with no
   proprietary tooling, no framework we invented, and no licence attached to it.
2. `npm install && npm run build` produces a `dist/` folder of static files.
   Those files are the entire website.
3. That folder can be uploaded to any static host: Cloudflare Pages, Netlify,
   Vercel, GitHub Pages, or plain nginx.
4. The form is one Worker file under `functions/`. It is about 100 lines and any
   developer can read it in ten minutes, or replace it with their own endpoint.
5. Remove our access from the Cloudflare and repository accounts. Nothing
   depends on us being there.

## 9. Support

- **Rate:** €50/hour. No retainer, no minimum, no monthly fee.
- **Typical jobs:** text and image changes, a new page, a form field, a
  redirect.
- **Contact:** info@ahdesign.website, (+359) 88 666 0034.

If you bought a package with a CMS, you can make text and image changes yourself
and only need us for structural work.

---

*Prepared by AH Design. Your site, your code, your domain.*
