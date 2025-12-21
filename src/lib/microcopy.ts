
export type MicrocopyType = 'CONFIRMATION';

export function getMicrocopy(type: MicrocopyType): string {
    const variants: Record<MicrocopyType, { text: string, weight: number }[]> = {
        CONFIRMATION: [
            { text: "Captured.", weight: 1.0 },
            { text: "Great thought.", weight: 0.8 },
            { text: "Nice.", weight: 0.8 },
            { text: "Good job logging that.", weight: 0.8 },
            { text: "Keep it up!", weight: 0.8 },
            { text: "You're doing great.", weight: 0.6 },
            { text: "Wonderful.", weight: 0.6 },
            { text: "Noted with care.", weight: 0.5 },
            { text: "Excellent.", weight: 0.5 },
            { text: "Positive vibes.", weight: 0.3 }
        ]
    };

    const list = variants[type];
    const totalWeight = list.reduce((a, b) => a + b.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of list) {
        if (random < item.weight) return item.text;
        random -= item.weight;
    }

    return list[0].text;
}
