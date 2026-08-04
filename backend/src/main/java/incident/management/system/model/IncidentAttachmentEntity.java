package incident.management.system.model;

import incident.management.system.enums.AttachmentType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Metadata record for a media attachment. The raw bytes live exclusively on
 * the application host's local filesystem under {@code objectKey} (a
 * server-generated relative path — never user input) — this row is only the
 * pointer + validation snapshot (MIME, size, uploader, original display name).
 */
@Entity
@Table(name = "incident_attachments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentAttachmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "incident_id", nullable = false)
    private IncidentEntity incident;

    @Column(nullable = false, unique = true, length = 512)
    private String objectKey;

    /** Original (sanitized) file name, for display only. */
    @Column(nullable = false, length = 160)
    private String fileName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttachmentType fileType;

    @Column(nullable = false, length = 100)
    private String mimeType;

    @Column(nullable = false)
    private Long fileSizeBytes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private UserEntity uploadedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadedAt;
}
