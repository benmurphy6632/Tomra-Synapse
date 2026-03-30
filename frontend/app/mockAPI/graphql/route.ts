import { NextRequest, NextResponse } from "next/server"

//mock data
export const mockData = {
    health: {
        status: "healthy",
        uptime: 99.97,
        
        classifierEngine: {
            avgLatency: 42,             // ms
            requestRate: 397,           // per min
            errorRate: 0.003,           // 0.30%
        },

        edgeNodes: [
            { name: "edge-cls-01", status: "up" },
            { name: "edge-cls-02", status: "up" },
            { name: "edge-cls-03", status: "up" },
            { name: "edge-cls-04", status: "up" },
        ],

        latencySeries: [
            { time: 35, value: 32 },
            { time: 40, value: 35 },
            { time: 45, value: 30 },
            { time: 50, value: 36 },
            { time: 55, value: 37 },
            { time: 60, value: 31 },
            { time: 65, value: 34 },
            { time: 70, value: 38 },
            { time: 75, value: 33 },
            { time: 80, value: 34 },
            { time: 85, value: 39 },
            { time: 90, value: 36 },
            { time: 95, value: 42 },
        ],

        requestRateSeries: [
            { time: 35, value: 400 },
            { time: 40, value: 430 },
            { time: 45, value: 420 },
            { time: 50, value: 390 },
            { time: 55, value: 450 },
            { time: 60, value: 405 },
            { time: 65, value: 470 },
            { time: 70, value: 385 },
            { time: 75, value: 410 },
            { time: 80, value: 445 },
            { time: 85, value: 460 },
            { time: 90, value: 455 },
            { time: 95, value: 397 },
        ],

        errorRateSeries: [
            { time: 95, value: 0.30 },
            { time: 100, value: 0.35 },
            { time: 105, value: 0.38 },
            { time: 110, value: 0.34 },
            { time: 115, value: 0.62 },
            { time: 120, value: 0.70 },
            { time: 125, value: 0.65 },
            { time: 130, value: 0.52 },
            { time: 135, value: 0.28 },
            { time: 140, value: 0.24 },
            { time: 145, value: 0.33 },
            { time: 150, value: 0.72 },
            { time: 155, value: 0.30 },
        ],

        // Model Performance
        modelMetrics: {
            accuracy: 94.2,
            precision: 92.8,
            recall: 93.5,
            f1Score: 93.1,
        },

        confusionMatrix: {
            trueNegative: 847,
            falsePositive: 23,
            falseNegative: 31,
            truePositive: 892,
        },

        rocCurve: [
            { fpr: 0.0, tpr: 0.0 },
            { fpr: 0.05, tpr: 0.30 },
            { fpr: 0.10, tpr: 0.55 },
            { fpr: 0.20, tpr: 0.78 },
            { fpr: 0.30, tpr: 0.88 },
            { fpr: 0.50, tpr: 0.94 },
            { fpr: 0.75, tpr: 0.97 },
            { fpr: 1.0, tpr: 1.0 },
        ],

        auc: 0.96,
    },

    modelVersions: [
        {
            version: "v2.4.1",
            status: "stable",
            accuracy: 0.9423,
            deployed: "3 days ago",
            description: "Current production model",
        },
        {
            version: "v2.5.0",
            status: "canary",
            accuracy: 0.9581,
            deployed: "4 hours ago",
            description: "Testing new architecture",
        },
        {
            version: "v2.3.6",
            status: "archived",
            accuracy: 0.9318,
            deployed: "2 weeks ago",
            description: "Previous stable release",
        },
        {
            version: "v2.3.2",
            status: "archived",
            accuracy: 0.9284,
            deployed: "3 weeks ago",
            description: "Baseline model for comparison",
        },
        {
            version: "v2.2.0",
            status: "archived",
            accuracy: 0.9172,
            deployed: "1 month ago",
            description: "Initial production deployment",
        },
    ]
};

function handlerGraphQLQuery(query: string) {
    if (query.includes('health')) {
        return {
            data: {health: mockData.health}
        };
    }

    if (query.includes('modelVersions')) {
        return {
            data: {modelVersions: mockData.modelVersions}
        };
    }

    return {errors: [{message: 'Query not found'}]};
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const {query} = body;

    const result = handlerGraphQLQuery(query);

    return NextResponse.json(result);
}