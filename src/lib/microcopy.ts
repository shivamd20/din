
export type MicrocopyType = 'CONFIRMATION' | 'CLOSURE' | 'HEADER';

export function getMicrocopy(type: MicrocopyType): string {
    const variants: Record<MicrocopyType, { text: string, weight: number }[]> = {
        CONFIRMATION: [
            { text: "Captured.", weight: 0.7 },
            { text: "Noted.", weight: 0.2 },
            { text: "Saved.", weight: 0.1 }
        ],
        CLOSURE: [
            { text: "Got it.", weight: 0.5 },
            { text: "That helps.", weight: 0.3 },
            { text: "All noted.", weight: 0.2 }
        ],
        HEADER: [
            { text: "If you want, you can add a little more context.", weight: 0.4 },
            { text: "Optional: add more context.", weight: 0.3 },
            { text: "Add more detail if it helps.", weight: 0.3 }
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
