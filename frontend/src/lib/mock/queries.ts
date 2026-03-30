export const GET_HEALTH = `
    query GetHealth {
        health {
            status
            uptime
            
            classifierEngine {
                avgLatency
                requestRate
                errorrate
            }
            
            edgeNodes {
                name
                status
            }
            
            latencySeries {
                time
                value
            }

            requestRateSeries {
                time
                value
            }

            errorRateSeries {
                time
                value
            }

            modelMetrics {
                accuracy
                precision
                recall
                f1Score
            }

            confusionMatrix {
                trueNegative
                falsePositive
                falseNegative
                truePositive
            }

            rocCurve {
                fpr
                tpr
            }

            auc
        }
    }
`;

export const GET_MODEL_VERSIONS = `
    query GetModelVersions {
        modelVersions {
            version
            status
            accuracy
            deployed
            description
        }
    }
`;