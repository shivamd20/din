
export interface ContextStripData {
    label: string;
    sublabel: string;
    type: 'work' | 'personal' | 'wind-down' | 'workout';
}

export interface CardAction {
    label: string;
    action: 'start' | 'snooze' | 'skip' | 'done' | 'remind' | 'open_capture';
    variant?: 'primary' | 'secondary' | 'danger';
}

export interface DynamicCardData {
    id: string;
    type: 'focus' | 'todo' | 'reflection' | 'habit' | 'goal';
    title: string;
    content: string | string[]; // string for simple text, array for TODOs
    actions: CardAction[];
}

export function useContextStrip() {
    // Mock logic based on time of day
    const hour = new Date().getHours();

    let data: ContextStripData = {
        label: 'Deep work day',
        sublabel: 'Low interruptions',
        type: 'work'
    };

    if (hour < 9) {
        data = { label: 'Morning routine', sublabel: 'Set the tone', type: 'personal' };
    } else if (hour >= 17 && hour < 20) {
        data = { label: 'Workout window', sublabel: '45 mins', type: 'workout' };
    } else if (hour >= 20) {
        data = { label: 'Evening wind-down', sublabel: 'Disconnect', type: 'wind-down' };
    }

    return { data };
}

export function useDynamicCards() {
    // Mock data for cards
    const cards: DynamicCardData[] = [
        {
            id: 'c1',
            type: 'focus',
            title: 'Focus now',
            content: 'You said you wanted to work on the Din UI today. Want to do 25 mins now?',
            actions: [
                { label: 'Start 25m', action: 'start', variant: 'primary' },
                { label: 'Snooze', action: 'snooze', variant: 'secondary' }
            ]
        },
        {
            id: 'c2',
            type: 'todo',
            title: 'Small things you can knock out',
            content: [
                'Reply to Alex',
                'Book slot for Dentist',
                'Pay electricity bill'
            ],
            actions: [
                { label: 'Done', action: 'done', variant: 'primary' }
            ]
        },
        {
            id: 'c3',
            type: 'reflection',
            title: 'Reflection',
            content: 'You’ve been thinking about the "Timeline" feature for 3 days. What’s the real blocker?',
            actions: [
                { label: 'Answer', action: 'open_capture', variant: 'primary' }
            ]
        },
        {
            id: 'c4',
            type: 'habit',
            title: 'Daily Reading',
            content: 'You usually read around this time.',
            actions: [
                { label: 'Done', action: 'done', variant: 'primary' },
                { label: 'Skip', action: 'skip', variant: 'secondary' }
            ]
        },
        {
            id: 'c5',
            type: 'goal',
            title: 'Long-term Goal Check',
            content: 'You said your long-term goal is to learn Spanish. Today’s notes mostly revolve around coding. Is that intentional?',
            actions: [
                { label: 'Yes', action: 'done', variant: 'secondary' },
                { label: 'Log Spanish time', action: 'open_capture', variant: 'primary' }
            ]
        }
    ];

    return { data: cards };
}
