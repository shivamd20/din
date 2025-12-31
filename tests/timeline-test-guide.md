# Timeline Feature Test Guide

Follow these steps sequentially to test the timeline feature in the UI.

## Prerequisites

1. Start the dev server: `npm run dev`
2. Open the app in your browser
3. Make sure you're logged in (or using anonymous auth)

---

## Step 1: Generate Initial Data

### 1.1 Create Some Captures

Go to the Home page and create several captures:

```
I want to exercise daily for the next month
I need to finish the project report by Friday
I'll review my progress every week
Meeting with team tomorrow at 2pm
Feeling good about my health routine
```

### 1.2 Wait for Feed Generation

- Wait 10-15 seconds for the feed workflow to process
- Refresh the page or navigate away and back
- Check that the Feed shows some items

### 1.3 Verify Data Creation

- Go to Commitments page - you should see at least one commitment
- Go to Tasks page (old view) - you should see some tasks

---

## Step 2: Test Empty Timeline State

### 2.1 Navigate to Tasks Page

- Click on "Tasks" in the bottom navigation
- You should see the new timeline view

### 2.2 Check Empty State

If you have no completed tasks yet:
- Should show "No timeline data yet" message
- Should have a clock icon
- Message should explain what will appear

---

## Step 3: Create Completed Tasks

### 3.1 Complete Some Tasks via Feed

- Go back to Home/Feed
- Find a task in the feed
- Complete it (if there's a complete action)
- Or create a capture: "Completed: [task name]"

### 3.2 Create Multiple Completed Tasks

Create captures for completed work:
```
Completed: Exercise routine this morning
Finished: Draft outline for project report
Done: Weekly review completed
```

### 3.3 Wait and Refresh

- Wait 10-15 seconds for processing
- Refresh the page
- Navigate back to Tasks page

---

## Step 4: Test Past Section

### 4.1 Verify Past Section Appears

- Should see "PAST" header
- Should see completed tasks listed
- Tasks should be grouped by date (Today, Yesterday, or date)

### 4.2 Check Past Task Details

For each past task, verify:
- ✅ Status badge (Completed/Missed/Adjusted)
- ✅ Task content
- ✅ Completion time (if available)
- ✅ Time spent vs. planned (if available)
- ✅ Commitment link (if linked to commitment)
- ✅ Streak indicator (if contributed to streak)

### 4.3 Test Expandable Details

- Click on a past task card
- Should expand to show:
  - Contextual note (if available)
  - Why missed (if it was missed)
  - Related commitment info

### 4.4 Test Commitment Navigation

- Click on a "Commitment" badge/link
- Should navigate to Commitment Detail page
- Navigate back to Tasks

---

## Step 5: Test Today Section

### 5.1 Verify Today Section

- Should see "TODAY" header
- Should show feed items that are currently in your feed
- Each feed item should show:
  - Task/content text
  - Generation reason (why it exists)
  - Priority score (if available)
  - Commitment link (if linked)

### 5.2 Check Suppressed Items

- Look for "Show X suppressed items" button
- Click to expand suppressed items
- Suppressed items should:
  - Appear greyed out/faded
  - Show suppression reason
  - Have "View in Feed" link
- Click "View in Feed" - should navigate to Home

### 5.3 Verify No Actions

- Confirm there are NO action buttons (Start, Snooze, Skip, Complete)
- Timeline should be read-only
- Only navigation links should work

---

## Step 6: Test Future Section

### 6.1 Verify Future Section

- Should see "FUTURE" header
- Should show projected tasks as "ghost cards" (grey, reduced opacity)

### 6.2 Check Future Projections

For each future projection, verify:
- ✅ Projection type badge (Planned by system, Expected milestone, etc.)
- ✅ Task content (predicted)
- ✅ Confidence score indicator
- ✅ "Why it exists" explanation
- ✅ "When it materializes" date
- ✅ Commitment link
- ✅ Pattern marker (for recurring habits, e.g., "Daily: Exercise")

### 6.3 Test Recurring Patterns

If you have daily/weekly commitments:
- Should see pattern markers like "Daily: [commitment]"
- Should see multiple occurrences in the future
- Should be grouped by week

### 6.4 Test Milestone Projections

If you have date-based commitments:
- Should see milestone tasks leading up to deadline
- Should show progress markers

---

## Step 7: Test Insights Section

### 7.1 Verify Insights Appear

- Should see "INSIGHTS" header (if there are insights)
- Should appear at the top of the timeline

### 7.2 Check Streak Cards

- Should show streak summaries
- Should display:
  - Current streak count
  - Longest streak (if different)
  - Description with identity-focused language
  - Commitment content (if per-commitment streak)

### 7.3 Check Pattern Insights

- Should show detected patterns
- Should display:
  - Pattern description (identity-focused)
  - Confidence score with visual indicator
  - Color coding (green for positive, blue for neutral)

### 7.4 Check Identity Hints

- Should show identity reinforcement messages
- Should use identity-first language
- Examples: "You're becoming someone who..." or "You're building reliability"

---

## Step 8: Test Filters

### 8.1 Test Commitment Filter

- Click on "Commitment" dropdown in filters
- Select a specific commitment
- Timeline should filter to show only items related to that commitment
- Select "All commitments" - should show everything again

### 8.2 Test Category Filter

- Click category chips (Work, Personal, Health)
- Timeline should filter by category
- Click again to deselect
- Note: Category filtering may not work if commitments don't have categories yet

### 8.3 Test Time Horizon Filter

- Click time horizon chips (Week, Month, Quarter)
- Timeline should filter to show items within that time frame
- Click again to deselect

### 8.4 Test Combined Filters

- Apply multiple filters at once
- Verify results are correctly filtered
- Clear all filters

---

## Step 9: Test Edge Cases

### 9.1 Test with No Commitments

- If possible, test with a user that has no commitments
- Future section should show empty state or no items
- Past and Today should still work

### 9.2 Test with No Completed Tasks

- If you have no completed tasks
- Past section should show empty state
- Today and Future should still work

### 9.3 Test with No Feed Items

- If feed is empty
- Today section should show empty state
- Past and Future should still work

### 9.4 Test Long Lists

- Create many completed tasks
- Verify Past section scrolls correctly
- Verify performance is acceptable

### 9.5 Test Future Projections

- Create commitments with different time horizons:
  - Daily commitment (should show 7-14 days ahead)
  - Weekly commitment (should show 4-8 weeks ahead)
  - Monthly commitment (should show 3-6 months ahead)
  - Date-based commitment (should show milestones)
- Verify projections appear correctly

---

## Step 10: Test Atomic Habits Integration

### 10.1 Verify Identity Language

- Check all text throughout timeline
- Should use identity-first language ("You are someone who...")
- Should NOT use guilt-based language
- Should celebrate progress

### 10.2 Verify Streak Celebration

- If you have active streaks
- Should see fire icons
- Should see celebration/encouragement messages
- Should highlight consistency

### 10.3 Verify Pattern Insights

- Should show patterns that reinforce identity
- Should help user understand their behavior
- Should be supportive, not judgmental

---

## Step 11: Test Read-Only Behavior

### 11.1 Verify No Actions Available

- Confirm NO "Start" buttons
- Confirm NO "Snooze" buttons
- Confirm NO "Skip" buttons
- Confirm NO "Complete" buttons
- Confirm NO drag-and-drop
- Confirm NO editing capabilities

### 11.2 Verify Navigation Works

- Clicking commitment links should navigate
- Clicking "View in Feed" should navigate
- Expanding/collapsing should work
- Filtering should work

### 11.3 Verify Mental Model

- Timeline = understanding/viewing
- Feed = doing/acting
- These should be clearly separated

---

## Step 12: Test Performance

### 12.1 Test Loading

- Navigate to Tasks page
- Should show loading state initially
- Should load within reasonable time (< 3 seconds)

### 12.2 Test Scrolling

- Scroll through Past section
- Scroll through Today section
- Scroll through Future section
- Should be smooth, no lag

### 12.3 Test Filtering Performance

- Apply filters
- Should update quickly
- Should not cause page freeze

---

## Step 13: Visual Verification

### 13.1 Check Visual Hierarchy

- Past section should look historical (completed state)
- Today section should look current (active state)
- Future section should look projected (ghost/grey state)

### 13.2 Check Color Coding

- Completed tasks: green badges
- Missed tasks: red/faded badges
- Adjusted tasks: blue badges
- Suppressed items: grey/faded
- Future projections: grey/ghost appearance

### 13.3 Check Spacing and Layout

- Sections should be clearly separated
- Items should have proper spacing
- Should be readable and not cramped

---

## Step 14: Test Data Consistency

### 14.1 Verify Data Matches Feed

- Items in Today section should match Feed items
- Suppressed items should be tasks not in Feed
- Data should be consistent

### 14.2 Verify Data Matches Commitments

- Future projections should match active commitments
- Commitment links should work correctly
- Commitment content should match

### 14.3 Verify Data Matches Tasks

- Past tasks should match completed/abandoned tasks
- Task details should be accurate
- Time spent should be correct

---

## Step 15: Final Verification

### 15.1 Complete Checklist

- [ ] Past section shows completed tasks
- [ ] Today section shows feed items + suppressed items
- [ ] Future section shows projections from commitments
- [ ] Insights section shows patterns and streaks
- [ ] Filters work correctly
- [ ] No action buttons (read-only)
- [ ] Navigation works
- [ ] Identity-focused language throughout
- [ ] Performance is acceptable
- [ ] Visual design is clear

### 15.2 Document Issues

If you find any issues:
1. Note the step where it occurred
2. Describe what happened
3. Describe what should have happened
4. Take screenshots if possible

---

## Expected Results Summary

### Past Section
- Shows historical ledger of completed/abandoned tasks
- Grouped by date
- Expandable details
- Shows context, time spent, streak contributions

### Today Section
- Shows current feed items with explanations
- Shows suppressed items with reasons
- No actions, just information

### Future Section
- Shows ghost task projections
- Pattern markers for recurring habits
- Confidence scores
- Explanations for why they exist

### Insights Section
- Streak summaries with celebration
- Pattern insights with identity focus
- Identity hints and encouragement

### Filters
- Filter by commitment
- Filter by category
- Filter by time horizon
- All read-only (no state changes)

---

## Notes

- Feed generation may take 10-15 seconds after creating captures
- Some features may require multiple captures to trigger
- Timeline updates when you refresh or navigate back
- All actions should happen in Feed, not Timeline

---

## Success Criteria

✅ Timeline is read-only (no actions)
✅ Past/Today/Future sections work correctly
✅ Insights show patterns and streaks
✅ Filters work correctly
✅ Identity-focused language throughout
✅ Performance is acceptable
✅ Visual design is clear and intuitive
✅ Mental model is clear: Feed = do, Timeline = understand

