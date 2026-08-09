package incident.management.system.enums;

import io.swagger.v3.oas.annotations.media.Schema;

/** Media category of an incident attachment. */
@Schema(description = "Media category of an incident attachment.")
public enum AttachmentType {
    IMAGE,
    VIDEO,
    AUDIO
}
