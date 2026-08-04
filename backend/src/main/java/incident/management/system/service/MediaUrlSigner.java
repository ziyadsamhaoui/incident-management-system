package incident.management.system.service;

import incident.management.system.config.MediaStorageProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Signs short-lived media read URLs ({@code /api/incidents/{id}/attachments/{attId}?token=…}).
 * <p>
 * {@code <img>} / {@code <video>} tags cannot attach an {@code Authorization}
 * header, so the read URL carries a compact HMAC capability: {@code {incidentId}.{attId}.{expiresMs}.{hmac}}.
 * The token is bound to a specific incident + attachment and expires after a few
 * minutes. Role/department scoping is enforced when the URL is issued
 * (the list endpoint), mirroring the old presigned-GET model.
 */
@Component
@Slf4j
public class MediaUrlSigner {

    private final SecretKeySpec key;
    private final long ttlMillis;

    public MediaUrlSigner(MediaStorageProperties props) {
        String secret = props.getSigningSecret();
        if (secret == null || secret.isBlank()) {
            secret = "dev-only-media-signing-secret-change-me";
            log.warn("app.media.signing-secret is not set — using an insecure dev default. Set MEDIA_SIGNING_SECRET in production.");
        }
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.ttlMillis = Math.max(60_000, props.getReadTokenTtlMinutes() * 60_000);
    }

    public String sign(Long incidentId, Long attachmentId) {
        long expiresMs = System.currentTimeMillis() + ttlMillis;
        String payload = incidentId + "." + attachmentId + "." + expiresMs;
        return payload + "." + hmacHex(payload);
    }

    /** Constant-time validity check: signature, binding and expiry. */
    public boolean verify(String token, Long incidentId, Long attachmentId) {
        if (token == null || token.isBlank()) {
            return false;
        }
        String[] parts = token.split("\\.");
        if (parts.length != 4) {
            return false;
        }
        try {
            if (Long.parseLong(parts[0]) != incidentId || Long.parseLong(parts[1]) != attachmentId) {
                return false;
            }
            String payload = parts[0] + "." + parts[1] + "." + parts[2];
            if (System.currentTimeMillis() > Long.parseLong(parts[2])) {
                return false;
            }
            byte[] expected = HexFormat.of().parseHex(parts[3]);
            byte[] actual = hmac(payload);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException e) { // includes NumberFormatException
            return false;
        }
    }

    private byte[] hmac(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    private String hmacHex(String payload) {
        return HexFormat.of().formatHex(hmac(payload));
    }
}
