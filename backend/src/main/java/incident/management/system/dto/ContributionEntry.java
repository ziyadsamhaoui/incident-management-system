package incident.management.system.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * A single contribution entry — one of three types:
 * <ul>
 *   <li>{@code DECLARATION} — an incident the user declared</li>
 *   <li>{@code CLAIM} — an incident the user took charge of</li>
 *   <li>{@code EVALUATION} — an incident the user evaluated (resolved/non-resolved)</li>
 * </ul>
 */
@Schema(description = "A single contribution entry for the authenticated user's activity history.")
public record ContributionEntry(
        @Schema(description = "Contribution type", example = "DECLARATION")
        String type,

        @Schema(description = "Incident ID", example = "143")
        Long incidentId,

        @Schema(description = "Incident reference number", example = "INC-2026-0143")
        String incidentReference,

        @Schema(description = "Incident description excerpt", example = "Panne machine ligne 3")
        String incidentDescription,

        @Schema(description = "Incident category name", example = "Sécurité")
        String category,

        @Schema(description = "Timestamp of this contribution (declared_at, claimed_at, or resolved_at)")
        LocalDateTime timestamp,

        @Schema(description = "Evaluation outcome — RESOLVED or NON_RESOLVED (EVALUATION type only, null otherwise)",
                example = "RESOLVED")
        String evaluationOutcome
) {}
