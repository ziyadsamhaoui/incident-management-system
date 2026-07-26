package incident.management.system.exception;

/**
 * Thrown when a CHEF_ATELIER user attempts to log in but their
 * {@code passwordHash} is {@code null}, indicating the account
 * was promoted by an Admin but never claimed by the user.
 * <p>
 * Maps to HTTP {@code 403 Forbidden} with a custom error payload
 * {@code { "code": "ACCOUNT_UNCLAIMED", "message": "Compte non réclamé. Veuillez d'abord réclamer votre compte." }}.
 */
public class AccountUnclaimedException extends RuntimeException {

    private final String code;

    public AccountUnclaimedException(String message) {
        super(message);
        this.code = "ACCOUNT_UNCLAIMED";
    }

    public String getCode() {
        return code;
    }
}
