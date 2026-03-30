package com.tomra.platform.graphql;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tomra.platform.dto.FeedbackStatsProjection;
import com.tomra.platform.service.FeedbackService;

class FeedbackQueryTest {

    private FeedbackService feedbackService;
    private FeedbackQuery feedbackQuery;

    @BeforeEach
    void setUp() {
        feedbackService = mock(FeedbackService.class);
        feedbackQuery = new FeedbackQuery(feedbackService);
    }

    @Test
    void feedbackStats_returnsProjectionFromService() {
        FeedbackStatsProjection mockStats = mock(FeedbackStatsProjection.class);
        when(feedbackService.getStats("project-1")).thenReturn(mockStats);

        FeedbackStatsProjection result = feedbackQuery.feedbackStats("project-1");

        assertNotNull(result);
        assertEquals(mockStats, result);
    }

    @Test
    void feedbackStats_callsServiceWithCorrectProjectId() {
        feedbackQuery.feedbackStats("project-1");

        verify(feedbackService, times(1)).getStats("project-1");
    }

    @Test
    void feedbackStats_returnsCorrectVoteCounts() {
        FeedbackStatsProjection mockStats = mock(FeedbackStatsProjection.class);
        when(mockStats.getUp()).thenReturn(5);
        when(mockStats.getDown()).thenReturn(2);
        when(mockStats.getUnsure()).thenReturn(1);
        when(feedbackService.getStats("project-1")).thenReturn(mockStats);

        FeedbackStatsProjection result = feedbackQuery.feedbackStats("project-1");

        assertNotNull(result);
        assertEquals(5, result.getUp());
        assertEquals(2, result.getDown());
        assertEquals(1, result.getUnsure());
    }

    @Test
    void feedbackStats_returnsNull_whenServiceReturnsNull() {
        when(feedbackService.getStats("unknown-project")).thenReturn(null);

        FeedbackStatsProjection result = feedbackQuery.feedbackStats("unknown-project");

        assertNull(result);
    }

    @Test
    void feedbackStats_usesCorrectProjectId_forDifferentProjects() {
        FeedbackStatsProjection stats1 = mock(FeedbackStatsProjection.class);
        FeedbackStatsProjection stats2 = mock(FeedbackStatsProjection.class);
        when(feedbackService.getStats("project-A")).thenReturn(stats1);
        when(feedbackService.getStats("project-B")).thenReturn(stats2);

        FeedbackStatsProjection result1 = feedbackQuery.feedbackStats("project-A");
        FeedbackStatsProjection result2 = feedbackQuery.feedbackStats("project-B");

        assertEquals(stats1, result1);
        assertEquals(stats2, result2);
    }
}