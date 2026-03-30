package com.tomra.platform.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tomra.platform.dto.FeedbackStatsProjection;
import com.tomra.platform.model.FeedbackEntity;
import com.tomra.platform.repository.FeedbackRepository;

class FeedbackServiceTest {

    private FeedbackRepository feedbackRepository;
    private FeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        feedbackRepository = mock(FeedbackRepository.class);
        feedbackService = new FeedbackService(feedbackRepository);
    }

    @Test
    void getStats_returnsProjectionFromRepository() {
        FeedbackStatsProjection mockStats = mock(FeedbackStatsProjection.class);
        when(feedbackRepository.getStats("project-1")).thenReturn(mockStats);

        FeedbackStatsProjection result = feedbackService.getStats("project-1");

        assertEquals(mockStats, result);
        verify(feedbackRepository, times(1)).getStats("project-1");
    }

    @Test
    void getStats_returnsNull_whenRepositoryReturnsNull() {
        when(feedbackRepository.getStats("unknown")).thenReturn(null);

        FeedbackStatsProjection result = feedbackService.getStats("unknown");

        assertNull(result);
    }

    @Test
    void saveVote_createsNewEntity_whenNoneExists() {
        when(
            feedbackRepository.findByProjectIdAndResultId(
                "project-1",
                950L
            )
        ).thenReturn(Optional.empty());

        feedbackService.saveVote(
            "project-1",
            950L,
            "resnet50",
            "image-1.jpg",
            "device-1",
            "http://localhost/image-1.jpg",
            "UP"
        );

        verify(feedbackRepository, times(1)).save(any(FeedbackEntity.class));
    }

    @Test
    void saveVote_updatesExistingEntity_whenOneExists() {
        FeedbackEntity existing = new FeedbackEntity();
        existing.setProjectId("project-1");
        existing.setResultId(950L);
        existing.setModel("resnet50");
        existing.setImageName("image-1.jpg");
        existing.setDeviceId("device-1");
        existing.setImageURL("http://localhost/image-1.jpg");
        existing.setVote("DOWN");

        when(
            feedbackRepository.findByProjectIdAndResultId(
                "project-1",
                950L
            )
        ).thenReturn(Optional.of(existing));

        feedbackService.saveVote(
            "project-1",
            950L,
            "resnet50",
            "image-1.jpg",
            "device-1",
            "http://localhost/image-1.jpg",
            "UP"
        );

        verify(feedbackRepository, times(1)).save(existing);
        assertEquals("UP", existing.getVote());
    }

    @Test
    void saveVote_setsAllFieldsCorrectly_onNewEntity() {
        when(
            feedbackRepository.findByProjectIdAndResultId(
                "project-2",
                207L
            )
        ).thenReturn(Optional.empty());

        feedbackService.saveVote(
            "project-2",
            207L,
            "resnet50",
            "image-2.jpg",
            "device-2",
            "http://localhost/image-2.jpg",
            "DOWN"
        );

        verify(feedbackRepository).save(any(FeedbackEntity.class));
    }

    @Test
    void removeVote_callsDeleteWithCorrectArguments() {
        feedbackService.removeVote(
            "project-1",
            950L
        );

        verify(feedbackRepository, times(1))
            .deleteByProjectIdAndResultId(
                "project-1",
                950L
            );
    }

    @Test
    void removeVote_doesNotCallSave() {
        feedbackService.removeVote(
            "project-1",
            950L
        );

        verify(feedbackRepository, never()).save(any());
    }
}