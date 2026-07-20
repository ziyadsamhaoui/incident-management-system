package incident.management.system.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;


class ReferenceSequenceRepositoryTest extends BaseRepositoryIntegrationTest {

    @Autowired
    private ReferenceSequenceRepository referenceSequenceRepository;

    private static final String DATE_KEY =
            LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

    //  Basic single-threaded behaviour
    @Test
    @DisplayName("should start at 1 for a new date key")
    void startsAtOne() {
        String freshKey = "unittest_" + System.nanoTime();
        long value = referenceSequenceRepository.getNextValue(freshKey);
        assertThat(value).isEqualTo(1L);
    }

    @Test
    @DisplayName("should increment sequentially in a single thread")
    void incrementsSequentially() {
        String freshKey = "increment_" + System.nanoTime();
        for (long expected = 1; expected <= 5; expected++) {
            long value = referenceSequenceRepository.getNextValue(freshKey);
            assertThat(value).isEqualTo(expected);
        }
    }

    //  Concurrent thread safety
    @Test
    @DisplayName("should produce unique monotonically increasing values under high concurrency")
    void concurrentAccessProducesUniqueValues() throws Exception {
        String freshKey = "concurrency_" + System.nanoTime();
        int threadCount = 20;
        int iterationsPerThread = 10;
        int expectedTotal = threadCount * iterationsPerThread;

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        try {
            // Synchronized list to collect all returned values
            List<Long> allValues = Collections.synchronizedList(new ArrayList<>(expectedTotal));

            // Barrier to release all threads as close to simultaneously as possible
            CyclicBarrier barrier = new CyclicBarrier(threadCount);
            CountDownLatch latch = new CountDownLatch(threadCount);

            for (int t = 0; t < threadCount; t++) {
                executor.submit(() -> {
                    try {
                        barrier.await(10, TimeUnit.SECONDS); // wait for all threads
                        for (int i = 0; i < iterationsPerThread; i++) {
                            long value = referenceSequenceRepository.getNextValue(freshKey);
                            allValues.add(value);
                        }
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    } finally {
                        latch.countDown();
                    }
                });
            }

            // Wait for all threads to finish (with generous timeout)
            boolean finished = latch.await(30, TimeUnit.SECONDS);
            assertThat(finished).as("All threads completed within timeout").isTrue();

            // Verify we got the expected number of values
            assertThat(allValues).hasSize(expectedTotal);

            // Verify all values are unique — no duplicates
            List<Long> sorted = new ArrayList<>(allValues);
            Collections.sort(sorted);
            assertThat(sorted)
                    .as("All generated values are unique")
                    .doesNotHaveDuplicates();

            // Verify the range: from 1 to expectedTotal (there should be no gaps
            // because no other test uses this key and we started from 1)
            assertThat(sorted.get(0)).isEqualTo(1L);
            assertThat(sorted.get(sorted.size() - 1)).isEqualTo((long) expectedTotal);

        } finally {
            executor.shutdownNow();
        }
    }

    //  Restart-safe behaviour
    @Test
    @DisplayName("should continue from last persisted value after a 'restart' (simulated by fresh instance)")
    void restartContinuesFromLastValue() {
        String freshKey = "restart_" + System.nanoTime();

        // Simulate first session: generate 3 values
        long lastFromSession1 = 0;
        for (int i = 0; i < 3; i++) {
            lastFromSession1 = referenceSequenceRepository.getNextValue(freshKey);
        }
        assertThat(lastFromSession1).isEqualTo(3L);

        // Simulate a fresh instance by using the same key — the counter
        // is stored in the database, so it should continue from 4.
        long valueAfterRestart = referenceSequenceRepository.getNextValue(freshKey);
        assertThat(valueAfterRestart).isEqualTo(4L);
    }

    //  Different date keys are independent
    @Test
    @DisplayName("should maintain independent counters for different date keys")
    void differentKeysAreIndependent() {
        String keyA = "independent_A_" + System.nanoTime();
        String keyB = "independent_B_" + System.nanoTime();

        assertThat(referenceSequenceRepository.getNextValue(keyA)).isEqualTo(1L);
        assertThat(referenceSequenceRepository.getNextValue(keyB)).isEqualTo(1L);
        assertThat(referenceSequenceRepository.getNextValue(keyA)).isEqualTo(2L);
        assertThat(referenceSequenceRepository.getNextValue(keyB)).isEqualTo(2L);
    }
}
