package incident.management.system.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.handler.SimpleUrlHandlerMapping;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

import java.util.List;
import java.util.Map;

/**
 * Wires authenticated, Range-capable media serving.
 * <p>
 * {@code GET /api/incidents/{id}/attachments/{attId}} is handled by a
 * {@link ResourceHttpRequestHandler} (via {@link SimpleUrlHandlerMapping}) so the
 * browser gets native {@code Accept-Ranges: bytes} / 206 partial-content support
 * for video seeking. Authorization is enforced by {@link MediaFileResourceResolver}
 * (signed read token, or JWT session + department scoping).
 * <p>
 * The mapping is registered with a *lower* precedence than
 * {@code RequestMappingHandlerMapping} (order 0), so it never shadows
 * {@code @RequestMapping} endpoints — it only matches the 5-segment media URL.
 */
@Configuration
@EnableConfigurationProperties(MediaStorageProperties.class)
@RequiredArgsConstructor
public class MediaServingConfig {

    private final ObjectProvider<MediaFileResourceResolver> resolverProvider;

    @Bean
    public SimpleUrlHandlerMapping mediaFileHandlerMapping(ResourceHttpRequestHandler mediaFileRequestHandler) {
        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setOrder(Ordered.LOWEST_PRECEDENCE - 2); // below @RequestMapping (0), above default static handler
        mapping.setUrlMap(Map.of("/api/incidents/{id}/attachments/{attId}", mediaFileRequestHandler));
        return mapping;
    }

    @Bean
    public ResourceHttpRequestHandler mediaFileRequestHandler() {
        ResourceHttpRequestHandler handler = new ResourceHttpRequestHandler();
        MediaFileResourceResolver resolver = resolverProvider.getIfAvailable();
        if (resolver != null) {
            handler.setResourceResolvers(List.of(resolver));
        }
        return handler;
    }
}
