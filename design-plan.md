# Mobile-First Redesign Specification

## goals
- **Harmonize**: Consistent Look & Feel (Zinc/White theme, clean typography).
- **Mobile First**: Bottom Navigation, large buttons, gesture friendly.
- **Fast Logging**: Home screen is immediately focused on logging.

## Architecture

### `MobileLayout`
Replaces the current `ProtectedLayout`. 
- **Top**: `Header` (Simplified, Profile + Sync Status).
- **Body**: `Outlet` with `pb-24` (padding for bottom nav).
- **Bottom**: `BottomNav` (Fixed, Glassmorphism).

### `BottomNav`
- **Tabs**:
  1. **Capture** (Home): The logging interface. Icon: `PenTool` or `Plus`.
  2. **Timeline**: View history. Icon: `Clock`.
  3. **Reflect**: The chat. Icon: `Sparkles` or `Brain`.

### Screens

#### 1. Capture (Home)
- Full focus text area.
- Bottom actions *above* the nav bar for attachments.
- "Capture" button is prominent or integrated into keyboard accessory view if possible (web limitation: stick to UI button).

#### 2. Timeline
- Read-only list.
- Clean cards.

#### 3. Reflect
- Existing Premium Chat UI, but adapted to fit within the Tab layout (maybe hide BottomNav when typing? Or keep it).
- User said "Harmonize". Keeping BottomNav is safer for navigation, but Chat input needs space.
- *Decision*: In Chat, we might obscure BottomNav or keep it. Let's keep it for consistency unless keyboard is up.

## Visuals
- **Font**: Sans-serif (Inter/Geist like).
- **Colors**: Zinc 50-900.
- **Touch**: Min 44px tap targets.
- **Feedback**: Haptic-like visual feedback (scale down on click).
