package incident.management.system.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;

/**
 * Real transactional email dispatcher backed by Spring's {@link JavaMailSender}.
 *
 * <p>Configured for Gmail SMTP ({@code smtp.gmail.com:587} + STARTTLS) through the
 * {@code MAIL_USERNAME} / {@code MAIL_PASSWORD} environment variables. Note that
 * Gmail requires an <b>App Password</b> (Google Account → Security → App passwords),
 * not the account's login password, when 2-Step Verification is enabled.
 *
 * <p>The frontend deep-link base URL is configurable via {@code app.frontend-url}
 * (defaults to {@code http://localhost:3000}), so the reset email always points at
 * the deployed origin.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private static final String BRAND = "ICGLMA — Incident Management";
    private static final int TOKEN_EXPIRY_MINUTES = 10;

    private final JavaMailSender mailSender;

    /** Base URL of the frontend used to build the password-reset deep link. */
    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /** Explicit from address; falls back to the SMTP username. */
    @Value("${app.mail.from:}")
    private String configuredFrom;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    /**
     * Sends the password-reset email with a 10-minute deep link to the confirm
     * screen. Throws {@link IllegalStateException} when the SMTP dispatch fails —
     * callers decide how to surface (or, for anti-enumeration, hide) the failure.
     */
    public void sendPasswordResetEmail(String to, String resetToken) {
        String resetUrl = frontendUrl + "/auth/reset-password/confirm?token=" + resetToken;

        String textBody = "Bonjour,\n\n"
                + "Vous avez demandé la réinitialisation de votre mot de passe.\n"
                + "Cliquez sur le lien ci-dessous (valable " + TOKEN_EXPIRY_MINUTES + " minutes) :\n\n"
                + resetUrl + "\n\n"
                + "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n"
                + "Cet email est envoyé par " + BRAND + ".";

        String htmlBody = "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;"
                + "border:1px solid #e5e7eb;border-radius:12px;overflow:hidden\">"
                + "<div style=\"background:#0F62FE;padding:20px 24px\">"
                + "<span style=\"color:#ffffff;font-size:16px;font-weight:bold\">ICGLMA — Incident Management</span>"
                + "</div>"
                + "<div style=\"padding:28px 24px;color:#1f2937\">"
                + "<p style=\"margin:0 0 12px;font-size:15px\">Bonjour,</p>"
                + "<p style=\"margin:0 0 20px;font-size:15px;line-height:1.6\">Vous avez demandé la "
                + "réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous "
                + "(lien valable <b>" + TOKEN_EXPIRY_MINUTES + " minutes</b>) :</p>"
                + "<p style=\"text-align:center;margin:0 0 24px\">"
                + "<a href=\"" + resetUrl + "\" style=\"display:inline-block;background:#0F62FE;"
                + "color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px\">"
                + "Réinitialiser mon mot de passe</a></p>"
                + "<p style=\"margin:0;color:#6b7280;font-size:12px;line-height:1.6\">Si vous n'êtes pas "
                + "à l'origine de cette demande, ignorez cet email — votre mot de passe restera inchangé.</p>"
                + "</div></div>";

        send(to, "Réinitialisation de votre mot de passe", textBody, htmlBody);
    }

    private void send(String to, String subject, String textBody, String htmlBody) {
        MimeMessage message = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(textBody, htmlBody);
            helper.setFrom(resolveFrom(), BRAND);
            mailSender.send(message);
            log.info("Password-reset email dispatched to {}", to);
        // MailException covers SMTP send failures (MailSendException) and must be
        // wrapped so callers deal with a single exception type — AuthService
        // relies on this to keep the neutral anti-enumeration response intact.
        } catch (MailException | MessagingException | UnsupportedEncodingException e) {
            throw new IllegalStateException(
                    "Failed to dispatch password-reset email to " + to, e);
        }
    }

    private String resolveFrom() {
        if (configuredFrom != null && !configuredFrom.isBlank()) {
            return configuredFrom;
        }
        if (smtpUsername != null && !smtpUsername.isBlank()) {
            return smtpUsername;
        }
        throw new IllegalStateException(
                "No 'from' address configured for outgoing mail — set app.mail.from or MAIL_USERNAME.");
    }
}
