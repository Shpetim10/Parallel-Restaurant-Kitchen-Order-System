package com.kds.concurrency;

import com.kds.enums.OrderStatus;
import com.kds.model.Order;
import com.kds.state.OrderStore;
import com.kds.websocket.KitchenEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BarrierCoordinatorTest {

    @Mock private KitchenEventPublisher eventPublisher;
    @Mock private OrderStore orderStore;
    @InjectMocks private BarrierCoordinator barrierCoordinator;

    private static final String ORDER_ID = "test-order-abc123";

    @BeforeEach
    void resetBarriers() throws Exception {
        // Ensure a clean barriers map before each test
        Field f = BarrierCoordinator.class.getDeclaredField("barriers");
        f.setAccessible(true);
        ((ConcurrentHashMap<?, ?>) f.get(barrierCoordinator)).clear();
    }

    // ── Test 1: correct party count ───────────────────────────────────────────

    @Test
    void testBarrierCreatedWithCorrectPartyCount() {
        CyclicBarrier barrier = barrierCoordinator.createBarrier(ORDER_ID, 3);

        assertThat(barrier).isNotNull();
        assertThat(barrier.getParties()).isEqualTo(3);
        assertThat(barrierCoordinator.hasBarrier(ORDER_ID)).isTrue();
        assertThat(barrierCoordinator.getBarrierCount()).isEqualTo(1);
    }

    // ── Test 2: barrier action fires after all parties arrive ─────────────────

    @Test
    void testBarrierActionFiresAfterAllPartiesAwait() throws Exception {
        Order order = Order.builder()
            .id(ORDER_ID)
            .orderStatus(OrderStatus.IN_PREPARATION)
            .build();
        when(orderStore.findById(ORDER_ID)).thenReturn(Optional.of(order));
        doNothing().when(eventPublisher).publishOrderReady(any());

        barrierCoordinator.createBarrier(ORDER_ID, 2);

        CountDownLatch bothReturned = new CountDownLatch(2);

        Thread t1 = new Thread(() -> {
            try {
                barrierCoordinator.await(ORDER_ID);
            } catch (BrokenBarrierException | InterruptedException | TimeoutException e) {
                Thread.currentThread().interrupt();
            } finally {
                bothReturned.countDown();
            }
        }, "barrier-party-1");

        Thread t2 = new Thread(() -> {
            try {
                barrierCoordinator.await(ORDER_ID);
            } catch (BrokenBarrierException | InterruptedException | TimeoutException e) {
                Thread.currentThread().interrupt();
            } finally {
                bothReturned.countDown();
            }
        }, "barrier-party-2");

        t1.start();
        Thread.sleep(100); // ensure t1 reaches barrier first
        t2.start();

        boolean completed = bothReturned.await(5, TimeUnit.SECONDS);
        t1.join(2000);
        t2.join(2000);

        assertThat(completed)
            .withFailMessage("Barrier did not release both threads within 5s")
            .isTrue();

        // Barrier action must have fired: order READY + readyAt set
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.READY);
        assertThat(order.getReadyAt()).isNotNull();
        verify(eventPublisher).publishOrderReady(order);
    }

    // ── Test 3: timeout throws TimeoutException ───────────────────────────────

    /**
     * Injects a CyclicBarrier subclass that immediately throws TimeoutException
     * on await(), simulating a slow/absent second party without waiting 30s.
     */
    @Test
    @SuppressWarnings("unchecked")
    void testBarrierTimeoutThrowsTimeoutException() throws Exception {
        barrierCoordinator.createBarrier(ORDER_ID, 2);

        Field barriersField = BarrierCoordinator.class.getDeclaredField("barriers");
        barriersField.setAccessible(true);
        ConcurrentHashMap<String, CyclicBarrier> barriers =
            (ConcurrentHashMap<String, CyclicBarrier>) barriersField.get(barrierCoordinator);

        // Replace real barrier with one that immediately simulates a timeout
        CyclicBarrier instantTimeout = new CyclicBarrier(2) {
            @Override
            public int await(long timeout, TimeUnit unit) throws TimeoutException {
                throw new TimeoutException("Simulated barrier timeout — second party never arrived");
            }
        };
        barriers.put(ORDER_ID, instantTimeout);

        assertThrows(TimeoutException.class, () -> barrierCoordinator.await(ORDER_ID));
    }

    // ── Test 4: barrier is removed after completion ───────────────────────────

    @Test
    void testBarrierRemovedAfterCompletion() {
        barrierCoordinator.createBarrier(ORDER_ID, 1);
        assertThat(barrierCoordinator.hasBarrier(ORDER_ID)).isTrue();
        assertThat(barrierCoordinator.getBarrierCount()).isEqualTo(1);

        barrierCoordinator.removeBarrier(ORDER_ID);

        assertThat(barrierCoordinator.hasBarrier(ORDER_ID)).isFalse();
        assertThat(barrierCoordinator.getBarrierCount()).isEqualTo(0);
    }
}
