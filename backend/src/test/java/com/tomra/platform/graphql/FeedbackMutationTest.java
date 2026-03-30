package com.tomra.platform.graphql;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.tomra.platform.service.FeedbackService;

class FeedbackMutationTest {

    private FeedbackService feedbackService;
    private FeedbackMutation feedbackMutation;

    @BeforeEach
    void setUp() {
        feedbackService = mock(FeedbackService.class);
        feedbackMutation = new FeedbackMutation(feedbackService);
    }

    @Test
    void voteFeedback_returnsTrue() {
        Boolean result = feedbackMutation.voteFeedback(
            "project-1",
            950L,
            "resnet50",
            "image-1.jpg",
            "device-1",
            "http://localhost/image-1.jpg",
            "UP"
        );

        assertNotNull(result);
        assertTrue(result, "Expected voteFeedback to return true");
    }

    @Test
    void voteFeedback_callsSaveVoteWithCorrectArguments() {
        feedbackMutation.voteFeedback(
            "project-1",
            950L,
            "resnet50",
            "image-1.jpg",
            "device-1",
            "http://localhost/image-1.jpg",
            "UP"
        );

        verify(feedbackService, times(1)).saveVote(
            "project-1",
            950L,
            "resnet50",
            "image-1.jpg",
            "device-1",
            "http://localhost/image-1.jpg",
            "UP"
        );
    }

    @Test
    void voteFeedback_withDownVote_callsSaveVoteCorrectly() {
        feedbackMutation.voteFeedback(
            "project-2",
            207L,
            "resnet50",
            "image-2.jpg",
            "device-2",
            "http://localhost/image-2.jpg",
            "DOWN"
        );

        verify(feedbackService, times(1)).saveVote(
            "project-2",
            207L,
            "resnet50",
            "image-2.jpg",
            "device-2",
            "http://localhost/image-2.jpg",
            "DOWN"
        );
    }

    @Test
    void voteFeedback_withUnsureVote_callsSaveVoteCorrectly() {
        feedbackMutation.voteFeedback(
            "project-3",
            281L,
            "resnet50",
            "image-3.jpg",
            "device-3",
            "http://localhost/image-3.jpg",
            "UNSURE"
        );

        verify(feedbackService, times(1)).saveVote(
            "project-3",
            281L,
            "resnet50",
            "image-3.jpg",
            "device-3",
            "http://localhost/image-3.jpg",
            "UNSURE"
        );
    }

    @Test
    void removeVote_returnsTrue() {
        Boolean result = feedbackMutation.removeVote(
            "project-1",
            950L
        );

        assertNotNull(result);
        assertTrue(result, "Expected removeVote to return true");
    }

    @Test
    void removeVote_callsRemoveVoteWithCorrectArguments() {
        feedbackMutation.removeVote(
            "project-1",
            950L
        );

        verify(feedbackService, times(1)).removeVote(
            "project-1",
            950L
        );
    }
}