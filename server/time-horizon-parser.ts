/**
 * Parse time horizon from user text to extract structured time horizon fields
 */

export interface ParsedTimeHorizon {
    time_horizon_type: "date" | "daily" | "weekly" | "monthly" | "continuous" | "maintain" | null;
    time_horizon_value: number | null; // timestamp if type="date"
    cadence_days: number | null; // recurring interval in days
}

/**
 * Parse time horizon from text using simple pattern matching
 * This is a basic implementation - can be enhanced with LLM parsing later
 */
export function parseTimeHorizonFromText(text: string): ParsedTimeHorizon {
    const lowerText = text.toLowerCase();
    
    // Check for specific date patterns
    const datePatterns = [
        /(?:by|before|until|due)\s+(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
        /(?:by|before|until|due)\s+(\d{1,2}[\/\-]\d{1,2}(?:\/\d{2,4})?)/i,
        /(?:by|before|until|due)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
        /(?:by|before|until|due)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i,
        /(?:by|before|until|due)\s+(?:in\s+)?(\d+)\s+(?:days?|weeks?|months?)/i
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            // Try to parse the date
            try {
                // For now, return "date" type - actual date parsing can be enhanced
                // The LLM will provide more accurate parsing in confirmCommitment
                return {
                    time_horizon_type: "date",
                    time_horizon_value: null, // Will be parsed by LLM
                    cadence_days: null
                };
            } catch {
                // Continue to next pattern
            }
        }
    }
    
    // Check for daily patterns
    if (/\b(?:daily|every\s+day|each\s+day|day\s+by\s+day)\b/i.test(lowerText)) {
        return {
            time_horizon_type: "daily",
            time_horizon_value: null,
            cadence_days: 1
        };
    }
    
    // Check for weekly patterns
    if (/\b(?:weekly|every\s+week|each\s+week|once\s+(?:a\s+)?week)\b/i.test(lowerText)) {
        return {
            time_horizon_type: "weekly",
            time_horizon_value: null,
            cadence_days: 7
        };
    }
    
    // Check for monthly patterns
    if (/\b(?:monthly|every\s+month|each\s+month|once\s+(?:a\s+)?month)\b/i.test(lowerText)) {
        return {
            time_horizon_type: "monthly",
            time_horizon_value: null,
            cadence_days: 30
        };
    }
    
    // Check for continuous/maintain patterns
    if (/\b(?:continuously|maintain|ongoing|keep\s+up|always)\b/i.test(lowerText)) {
        return {
            time_horizon_type: "continuous",
            time_horizon_value: null,
            cadence_days: null
        };
    }
    
    // Default: no specific time horizon detected
    return {
        time_horizon_type: null,
        time_horizon_value: null,
        cadence_days: null
    };
}

