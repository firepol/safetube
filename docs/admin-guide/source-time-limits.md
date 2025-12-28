# Source-Level Time Limits: Parent/Admin Guide

A practical guide for parents and administrators to manage source-level time limits in SafeTube.

## Quick Start

1. **Go to Admin Settings** → **Video Sources**
2. **Select a source** (YouTube channel, playlist, or local folder)
3. **Click "Edit"** and set a daily time limit (in minutes)
4. **Save** - the limit is now active

That's it! The source is now time-limited.

## Setting Up Limits

### Step 1: Open Admin Settings

1. Open SafeTube
2. Click the **Settings/Gear icon** in the top right
3. Log in with your admin password (if set)
4. Go to the **"Video Sources"** section

### Step 2: Choose Which Source to Limit

You'll see a list of all configured sources:
- **YouTube channels** (e.g., "YouTube - Paw Patrol", "YouTube - NASA")
- **YouTube playlists** (e.g., "My Playlist")
- **Local folders** (e.g., "/Videos/Movies", "/Videos/Educational")

Decide which source(s) you want to limit. Common strategies:

**By Content Type:**
- Entertainment channels → 20-30 min/day
- Educational channels → 60-90 min/day
- News/weather → Unlimited

**By Time-Wasting Factor:**
- YouTube recommendations → 15 min/day (easy to lose track of time)
- Local educational videos → 120 min/day (parent-approved content)

**By Child Development:**
- Preschool content → Unlimited
- Elementary school entertainment → 30 min/day
- Teen gaming videos → 20 min/day

### Step 3: Edit the Source

1. Click **"Edit"** next to the source name
2. Look for the **"Daily Time Limit"** field
3. Enter a number in minutes:
   - **Leave blank or "Unlimited"** = No daily limit
   - **0** = Block this source completely
   - **5** = 5 minutes per day
   - **30** = 30 minutes per day
   - **1440** = 24-hour access (essentially unlimited)
4. Click **"Save"**

The limit is immediately enforced.

### Step 4: Verify It's Working

1. Go back to the **Video Sources** list
2. Look for the source you just limited
3. You should see:
   - **Daily Limit** column showing "30 min" (or whatever you set)
   - **Remaining Today** column showing the current time remaining
   - A **+ Time** button if you want to grant extensions

## Understanding the Time Display

### In the Admin Panel

Each source shows:

| Element | Meaning |
|---------|---------|
| **Daily Limit** | The maximum time set for this source |
| **Progress Bar** | How much of the daily limit has been used (visual %) |
| **Time Remaining** | How many minutes/seconds left for today |
| **Color** | 🟢 Green (>5 min left), 🟠 Orange (1-5 min left), 🔴 Red (limit exceeded) |

### Interpretation Examples

| Scenario | Display | Action |
|----------|---------|--------|
| New day, no usage | "30m remaining" + full bar | Child can watch normally |
| Child watched 15 min | "15m remaining" + half bar | Still 15 min available |
| 4 minutes left | "4m 32s remaining" (orange) | Will block soon |
| Limit exceeded | "Limit exceeded" (red bar) | Source is blocked |

## Granting Extensions

When your child reaches their time limit and asks for more time:

### Quick Method (1 click)

1. In Admin Settings → Video Sources
2. Find the source (will show "Limit exceeded" in red)
3. Click the **"+ Time"** button next to it
4. Select how much time to add:
   - **5 minutes** (smallest increment)
   - **10 minutes**
   - **15 minutes**
   - **30 minutes** (largest increment)
5. ✅ Done! Time is granted immediately

The extension appears in the parent request interface on the time-up screen.

### What Happens After Extension

- The source time limit is temporarily increased
- The extension applies **only to today** (resets at midnight)
- The child can resume watching from that source
- **Global daily limit still applies** - if that's also reached, playback still blocks

### Extension Best Practices

**Give extensions strategically:**
- ✅ Special occasions ("It's the finale, and I want to finish it")
- ✅ Educational content ("I need 10 more minutes for my project")
- ✅ Rare requests (not every day)
- ❌ Avoid regular extensions - raise the permanent limit instead

**Permanent vs. Temporary:**
- **Temp Extension:** Child reaches 30-min limit, you grant 5 min extension today
- **Permanent Increase:** Child consistently uses their full 30-min allotment, you raise to 45 min

## Monitoring Usage

### Daily Monitoring

**Each morning, check:**
1. Admin Settings → Video Sources
2. Review the "Remaining Today" for each limited source
3. Reset happens at midnight automatically

**Questions to answer:**
- Did my child use their allotted time yesterday?
- Are there patterns (e.g., always maxing out YouTube)?
- Do limits seem too strict/loose?

### Weekly Review

**Every weekend, evaluate:**
- Total usage across all sources
- Which sources are most used
- Whether limits are appropriate

### Pattern Recognition

Watch for patterns like:
- **Consistent max usage** → Limit might be too high (child always uses it all)
- **Minimal usage** → Limit might be too high (child not interested)
- **Regular extension requests** → Limit might be too low (child wants more)
- **Switching sources** → Source limits working (child respects them)

## Common Scenarios

### Scenario 1: YouTube Addiction

**Problem:** Child spends all their time on one YouTube channel.

**Solution:**
1. Set that channel to **15 minutes/day**
2. Set other approved channels to **45 minutes/day**
3. Keep global limit at **90 minutes/day**

Now the "addictive" channel gets limited, but child can switch to other sources.

### Scenario 2: Educational Project

**Problem:** Child needs more time for research on a specific topic.

**Solution:**
1. Grant a **one-time extension** (e.g., 30 minutes) for that day
2. Don't permanently raise the limit
3. Extension resets tomorrow
4. If this is common, discuss raising the permanent limit

### Scenario 3: Parental Control During School

**Problem:** Child should focus on homework during school hours.

**Solution:**
- Set global daily limit to enforce total daily time
- Note: Source-level limits can't currently restrict by time-of-day
- For time-of-day restrictions, adjust global daily limit instead

### Scenario 4: Multi-Child Household

**Problem:** Different children, different limits.

**Solution:**
- **Current workaround:** Use one device per child with different limits configured
- **Future version:** Per-profile limits will solve this better

### Scenario 5: Overnight Limits Reset

**Problem:** Child watches until 11:50pm, limit resets at midnight, watches more 12:05am.

**Solution:**
- This is working as designed (separate daily limits)
- To prevent late-night watching, reduce global daily limit
- Consider a bedtime enforcer (future feature)

## Troubleshooting

### "I set a limit but it's not working"

**Possible causes:**

1. **Limit might be NULL/blank** (equals unlimited)
   - Fix: Edit source, enter a number (e.g., 30 for 30 minutes)

2. **Source might not be configured correctly**
   - Fix: Verify source exists in Video Sources list, try editing it

3. **Limit might be very high** (e.g., 1440 = full day)
   - Fix: Lower the limit number

**Verify it's working:**
- Set to a very low number (e.g., 1 minute)
- Child watches for 2 minutes
- Should see "Limit exceeded" message
- Then adjust to desired value

### "Extension granted but time isn't increasing"

**Possible causes:**

1. **Extension didn't save** (button click didn't register)
   - Fix: Try again, wait for confirmation message

2. **Watching while granting extension** (race condition)
   - Fix: Child should stop watching before extension granted
   - The system checks limit at playback start, not continuously

3. **Source doesn't have a limit set** (extension only for limited sources)
   - Fix: Verify source has a time limit configured

### "Time remaining is wrong"

**Possible causes:**

1. **Limit just set, need time to calculate**
   - Fix: Wait a moment, refresh the admin panel (auto-refreshes every 60 sec)

2. **System clock is wrong**
   - Fix: Check device time zone and system time settings
   - Limits reset at local midnight

3. **Child still watching during limit check**
   - Fix: Wait for video to pause/stop
   - Time is updated when playback activity is recorded

### "Child can still watch after limit reached"

**Possible causes:**

1. **Global limit not reached yet** (only source limit exceeded)
   - Fix: This is correct behavior - source blocked, other sources available
   - Check global limit hasn't been reached also

2. **Extension was granted** (extends limit temporarily)
   - Fix: Check " Remaining Today" shows extension reflected
   - Extension resets at midnight

3. **Limit was removed/changed** (you accidentally edited it)
   - Fix: Re-verify the limit is set

### "Can't find the Video Sources section"

**Steps:**
1. Click Settings (gear icon)
2. Log in if prompted
3. Look for "Video Sources" or "Sources"
4. If not visible, might be in "Advanced" section

## Tips & Tricks

### Preset Limits

Common configurations:

**Balanced Approach:**
- Entertainment YouTube → 20 min/day
- Educational YouTube → 60 min/day
- Local approved videos → 90 min/day
- Global limit → 120 min/day

**Strict Approach:**
- All YouTube → 15 min/day
- All local → 30 min/day
- Global limit → 45 min/day

**Permissive Approach:**
- All sources → Unlimited (set via NULL)
- Global limit → 120 min/day (one limit only)

### Gradually Adjust Limits

**If reducing screen time:**
1. Start with current usage + 10%
2. Every 2 weeks, reduce by 10%
3. Stop at your target limit
4. Monitor for complaints (normal) vs. frustration (might be too low)

**Example:**
- Week 1-2: 90 min (current usage)
- Week 3-4: 80 min
- Week 5-6: 70 min
- Week 7+: 60 min (target)

### Weekend vs. Weekday

**Current limitations:** SafeTube applies same limits every day.

**Workaround:** Manually adjust limits on Friday evening and Sunday evening.

**Future feature:** Different limits for different days of week.

### Communicate Limits

**Tell your child:**
- ✅ What the daily limit is
- ✅ Why you set it
- ✅ How to request extensions
- ✅ What happens when limit is reached

**Don't:**
- ❌ Use limits as punishment (set fair limits instead)
- ❌ Surprise them with limit reduction (discuss first)
- ❌ Grant extensions without reason (makes them seem arbitrary)

## Database Location

Source limits are stored in your SafeTube database (automatically managed). No manual database editing needed.

**For advanced users only:**
- Database: Located in app data directory
- Table: `sources` (column: `daily_time_limit_minutes`)
- Never edit database directly without backup

## Questions?

- Check the [Feature Overview](/docs/features/source-time-limits/README.md) for detailed information
- See [API Reference](/docs/api/timeTracking-source-limits.md) for technical details
- Review [Technical Design](/docs/features/source-time-limits/design.md) for how it works internally

## Related Features

- **Global Daily Limit** - Set a total daily time limit across all sources
- **Watched History** - View which videos have been watched
- **Video Favorites** - Mark approved videos for quick access
