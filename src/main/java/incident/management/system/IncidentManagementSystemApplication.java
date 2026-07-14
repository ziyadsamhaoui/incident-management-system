package incident.management.system;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IncidentManagementSystemApplication {

    public static void main(String[] args) {
        SpringApplication.run(IncidentManagementSystemApplication.class, args);
    }

}
