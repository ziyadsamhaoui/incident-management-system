package incident.management.system.service;

import incident.management.system.enums.AttachmentType;

import java.util.Arrays;

/**
 * Magic-byte (file-signature) sniffing for the attachment confirm step.
 * <p>
 * The presigned PUT already locks the {@code Content-Type} into the signature
 * (S3 rejects mismatched headers), so this is defense-in-depth against spoofed
 * payloads: the backend reads only the first 16 bytes via an S3 range GET —
 * never the whole file.
 */
public final class MagicByteValidator {

    private MagicByteValidator() {
    }

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] WEBM = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3}; // EBML — WebM/MKV
    private static final byte[] OGG = {'O', 'g', 'g', 'S'};
    private static final byte[] ID3 = {'I', 'D', '3'};
    private static final byte[] RIFF = {'R', 'I', 'F', 'F'};

        /**
     * Returns true when the first bytes of the object match the declared
     * content type. When the MIME is not specifically mapped, falls back to a
     * family-level check (any signature of the declared {@link AttachmentType}).
     */
    public static boolean matches(AttachmentType type, String mimeType, byte[] head) {
        if (head == null || head.length == 0) {
            return false;
        }
        return switch (type) {
            case IMAGE -> isImage(mimeType, head);
            case VIDEO -> isVideo(mimeType, head);
            case AUDIO -> isAudio(mimeType, head);
        };
    }

    private static boolean isImage(String mime, byte[] h) {
        return switch (mime.toLowerCase(java.util.Locale.ROOT)) {
            case "image/jpeg" -> startsWith(h, JPEG);
            case "image/png" -> startsWith(h, PNG);
            case "image/gif" -> asciiAt(h, 0, 4).equals("GIF8");
            case "image/webp" -> startsWith(h, RIFF) && asciiAt(h, 8, 12).equals("WEBP");
            case "image/heic", "image/heif", "image/avif" -> asciiAt(h, 4, 8).equals("ftyp");
            default -> isAnyImage(h);
        };
    }

    private static boolean isVideo(String mime, byte[] h) {
        return switch (mime.toLowerCase(java.util.Locale.ROOT)) {
            case "video/mp4", "video/quicktime" -> asciiAt(h, 4, 8).equals("ftyp");
            case "video/webm" -> startsWith(h, WEBM);
            case "video/x-msvideo" -> startsWith(h, RIFF) && asciiAt(h, 8, 12).equals("AVI ");
            default -> isAnyVideo(h);
        };
    }

    private static boolean isAudio(String mime, byte[] h) {
        return switch (mime.toLowerCase(java.util.Locale.ROOT)) {
            case "audio/webm" -> startsWith(h, WEBM);
            case "audio/ogg" -> startsWith(h, OGG);
            case "audio/mpeg" -> isMp3FrameHeader(h);
            case "audio/wav", "audio/x-wav" -> startsWith(h, RIFF) && asciiAt(h, 8, 12).equals("WAVE");
            case "audio/mp4", "audio/x-m4a", "audio/aac" -> asciiAt(h, 4, 8).equals("ftyp");
            default -> isAnyAudio(h);
        };
    }

    private static boolean isAnyImage(byte[] h) {
        return startsWith(h, JPEG)
                || startsWith(h, PNG)
                || (startsWith(h, RIFF) && asciiAt(h, 8, 12).equals("WEBP"))
                || asciiAt(h, 0, 4).equals("GIF8")
                || asciiAt(h, 4, 8).equals("ftyp"); // HEIC / HEIF / AVIF / MIF1
    }

    private static boolean isAnyVideo(byte[] h) {
        return asciiAt(h, 4, 8).equals("ftyp")   // MP4 / MOV / M4V
                || startsWith(h, WEBM)            // WebM
                || (startsWith(h, RIFF) && asciiAt(h, 8, 12).equals("AVI "));
    }

    private static boolean isAnyAudio(byte[] h) {
        return startsWith(h, WEBM)                // WebM/Opus (MediaRecorder audio)
                || startsWith(h, OGG)
                || startsWith(h, ID3)
                || isMp3FrameHeader(h)
                || (startsWith(h, RIFF) && asciiAt(h, 8, 12).equals("WAVE"))
                || asciiAt(h, 4, 8).equals("ftyp"); // M4A / AAC-in-MP4
    }

    private static boolean isMp3FrameHeader(byte[] h) {
        // 0xFF sync + MPEG audio version bits in the second byte (0xE0 mask).
        return h.length >= 2 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xE0) == 0xE0;
    }

    private static boolean startsWith(byte[] haystack, byte[] needle) {
        if (haystack.length < needle.length) {
            return false;
        }
        return Arrays.equals(Arrays.copyOf(haystack, needle.length), needle);
    }

    /** ASCII substring between {@code from} (inclusive) and {@code to} (exclusive), or "". */
    private static String asciiAt(byte[] h, int from, int to) {
        if (h.length < to) {
            return "";
        }
        return new String(Arrays.copyOfRange(h, from, to), java.nio.charset.StandardCharsets.US_ASCII);
    }
}
