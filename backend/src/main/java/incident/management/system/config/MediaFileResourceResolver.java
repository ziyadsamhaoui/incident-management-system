package incident.management.system.config;

import incident.management.system.exception.AttachmentPolicyException;
import incident.management.system.model.IncidentAttachmentEntity;
import incident.management.system.model.UserEntity;
import incident.management.system.repository.IncidentAttachmentRepository;
import incident.management.system.repository.UserRepository;
import incident.management.system.security.CurrentUserResolver;
import incident.management.system.service.LocalFileStorageService;
import incident.management.system.service.MediaAccessPolicy;
import incident.management.system.service.MediaUrlSigner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.resource.ResourceResolver;
import org.springframework.web.servlet.resource.ResourceResolverChain;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Resolves {@code GET /api/incidents/{id}/attachments/{attId}} to the physical
 * file on disk for {@link org.springframework.web.servlet.resource.ResourceHttpRequestHandler}.
 * <p>
 * Access is granted either through a short-lived signed read token (used by
 * {@code <img>}/{@code <video>} tags, which cannot send Authorization headers)
 * or through the normal JWT-authenticated session (which additionally enforces
 * department/ownership scoping). The token binds to a specific incident +
 * attachment and was only issued to an authorized caller by the list endpoint.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MediaFileResourceResolver implements ResourceResolver {

    private final IncidentAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final LocalFileStorageService fileStorage;
    private final MediaUrlSigner urlSigner;

    @Override
    public Resource resolveResource(HttpServletRequest request, String requestPath,
                                    List<? extends Resource> locations, ResourceResolverChain chain) {
        long[] ids = extractIds(request);
        if (ids == null) {
            return null;
        }
        long incidentId = ids[0];
        long attachmentId = ids[1];

        // Authenticated session (JWT) → enforce full role/department scoping.
        UserEntity user = CurrentUserResolver.resolve(userRepository);
        if (user != null) {
            return resolveForUser(incidentId, attachmentId, user);
        }

        // Browser media tag → validate the signed capability token.
        String token = request.getParameter("token");
        if (token == null || !urlSigner.verify(token, incidentId, attachmentId)) {
            throw new AttachmentPolicyException(HttpStatus.UNAUTHORIZED,
                    "Jeton de lecture média invalide ou expiré.");
        }
        return resolveFile(incidentId, attachmentId);
    }

    @Override
    public String resolveUrlPath(String resourcePath, List<? extends Resource> locations,
                                 ResourceResolverChain chain) {
        return null;
    }

    private Resource resolveForUser(long incidentId, long attachmentId, UserEntity user) {
        IncidentAttachmentEntity attachment = loadLiveAttachment(incidentId, attachmentId);
        MediaAccessPolicy.assertCanAccess(attachment.getIncident(), user);
        return fileResource(attachment);
    }

    private Resource resolveFile(long incidentId, long attachmentId) {
        return fileResource(loadLiveAttachment(incidentId, attachmentId));
    }

    /**
     * Loads the attachment and verifies it is still live — matching incident
     * AND not soft-deleted by the admin media surface. Soft-deleted audit stubs
     * keep their row but lost their file pointer ({@code object_key = NULL}), so
     * they must answer 404 rather than crash.
     */
    private IncidentAttachmentEntity loadLiveAttachment(long incidentId, long attachmentId) {
        IncidentAttachmentEntity attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new AttachmentPolicyException(HttpStatus.NOT_FOUND, "Pièce jointe introuvable."));
        if (attachment.getIncident() == null
                || attachment.getIncident().getId() == null
                || attachment.getIncident().getId() != incidentId
                || attachment.isDeleted()) {
            throw new AttachmentPolicyException(HttpStatus.NOT_FOUND, "Pièce jointe introuvable.");
        }
        return attachment;
    }

    private Resource fileResource(IncidentAttachmentEntity attachment) {
        if (attachment.getObjectKey() == null) {
            throw new AttachmentPolicyException(HttpStatus.NOT_FOUND, "Pièce jointe introuvable.");
        }
        Path path = fileStorage.resolve(attachment.getObjectKey());
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throw new AttachmentPolicyException(HttpStatus.NOT_FOUND,
                    "Le fichier média n'existe plus sur le serveur.");
        }
        return new FileSystemResource(path);
    }

    /** Extracts {id, attId} from the URI template variables set by SimpleUrlHandlerMapping. */
    @SuppressWarnings("unchecked")
    private long[] extractIds(HttpServletRequest request) {
        Object vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (vars instanceof Map<?, ?> map) {
            try {
                long incidentId = Long.parseLong(String.valueOf(map.get("id")));
                long attachmentId = Long.parseLong(String.valueOf(map.get("attId")));
                return new long[]{incidentId, attachmentId};
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
