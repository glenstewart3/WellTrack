import os
import smtplib
from email.message import EmailMessage


def send_email_smtp(*, to_emails: list[str], subject: str, body_text: str, body_html: str | None = None):
    """Send an email via SMTP using env vars.

    Required env:
      SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, EMAIL_FROM

    Optional:
      SMTP_USE_SSL=true/false (default true when port=465)
      SMTP_USE_TLS=true/false (STARTTLS; default false)
      EMAIL_REPLY_TO
    """
    if not to_emails:
        return {"sent": 0}

    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "465"))
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    email_from = os.environ.get("EMAIL_FROM", "").strip()
    reply_to = os.environ.get("EMAIL_REPLY_TO", "").strip() or None

    if not host or not username or not password or not email_from:
        raise RuntimeError("SMTP is not configured (missing SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD/EMAIL_FROM)")

    use_ssl = os.environ.get("SMTP_USE_SSL")
    use_tls = os.environ.get("SMTP_USE_TLS")
    if use_ssl is None:
        use_ssl = "true" if port == 465 else "false"
    use_ssl = str(use_ssl).strip().lower() in ("1", "true", "yes", "y")
    use_tls = str(use_tls).strip().lower() in ("1", "true", "yes", "y")

    msg = EmailMessage()
    msg["From"] = email_from
    msg["To"] = ", ".join(to_emails)
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    if use_ssl:
        with smtplib.SMTP_SSL(host, port) as smtp:
            smtp.login(username, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port) as smtp:
            if use_tls:
                smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(msg)

    return {"sent": len(to_emails)}

