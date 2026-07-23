package incident.management.system.service;

import incident.management.system.repository.ReferenceSequenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;


@Service
@RequiredArgsConstructor
public class IncidentReferenceGenerator {

    private static final String PREFIX = "INC";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final ZoneId CASABLANCA_ZONE = ZoneId.of("Africa/Casablanca");

    private final ReferenceSequenceRepository ReferenceSequenceRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String generateReference() {
        String dateKey = ZonedDateTime.now(CASABLANCA_ZONE).format(DATE_FORMATTER);
        long sequence = ReferenceSequenceRepository.getNextValue(dateKey);
        return String.format("%s-%s-%04d", PREFIX, dateKey, sequence);
    }
}
