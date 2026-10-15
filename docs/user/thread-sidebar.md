# Working with threads

Use a new thread for a separate task. Choose **New worktree** when its code changes
need a separate branch and working directory.

## Start a thread

On web and desktop, a new thread keeps the current project and carries your model
and mode selections, unless the destination project has its own model default.
Its branch and workspace mode come from your configured defaults. To continue in
an existing worktree, use **New thread in this worktree** from the branch toolbar.
On mobile, a new task opens in the project you last chose; tap the project in the
draft to pick another.

When you change a new thread's project, Supacode stays in the current environment
if that project exists there. Otherwise it selects an environment that has it.

### Start without a project

A thread does not need a project. To start one without a project, pick **No
project** from the project menu above a new thread's prompt or from **New thread
in...** in the command palette, or press `mod+alt+n`. On mobile, pick **No
project** from the project list. It starts on your current machine; before
sending, pick another machine from the machine menu to move it there. To move a
draft into a project, pick the project in that menu.

Each thread without a project works in its own folder under `~/.supacode/scratch` (the
`scratch` folder of your Supacode data directory), named after its date, the first words
of its first message, and a short id, like
`2026-09-25-convert-these-pngs-to-webp-a1b2c3d4`. Deleting a thread keeps its
folder, so the files the agent wrote stay until you delete them. Branch, worktree, and diff controls stay hidden because
these folders are not Git repositories. This is unavailable when the data
directory itself sits inside a Git checkout.

### Send feedback

Choose **Help > Send feedback** at the bottom of the sidebar, or **Send feedback** in
the command palette. On mobile, open **Settings > About Supacode**. Supacode opens a
new thread under **No project** with a prepared message in the prompt, using your
usual model and settings. Add anything you like and send it. The agent runs
`supacode triage --print`, asks what happened, and investigates on that machine.
Review the report before the agent posts it to GitHub.

If the app cannot open, run `supacode triage` in a terminal on the affected machine
instead.

### Start in the background

Sending a new thread starts it in the background: it joins **Working** in the sidebar
and another draft opens, so you can start the next conversation right away. Open the
thread from the sidebar when it needs you. To send and open it instead, press
`Cmd+Enter` on macOS or `Ctrl+Enter` on Windows and Linux in a desktop browser or the
desktop app. The next draft keeps the workspace mode and base branch you selected.
With **New worktree**, each background submission creates its own worktree.

To send the same prompt to several models on web or desktop, **Shift-click** models
in a new thread's model picker to add or remove them. A regular click returns to a
single model. Choose a base branch and send. Each selection starts a separate thread
and worktree while you stay in the new thread composer. This requires a Git project.

## Pin and reorder threads

Pin a thread from its menu to keep it above your active work.

On web and desktop, unpinning, settling, snoozing, and archiving a thread each show
a notification with **Undo** for five seconds. Undo restores the thread's previous
state, including its pinned position, and reopens an archived thread you were
viewing. Discarding an unsent draft from the sidebar works the same way: Undo brings
back its text and attachments. `mod+z` triggers the most recent Undo when no text field is focused; see
[Keybindings](./keybindings.md#commands-with-special-behavior).

On web and desktop, you can also drag files from your computer onto any thread row:
the thread opens and the files are attached in its composer, ready for
your next message. The same per-message file limits apply as when attaching
files directly; see [Attach files](./composer.md#attach-files).

On web and desktop, pinning or unpinning a thread keeps the sidebar at your current
scroll position instead of following the thread to its new place in the list.

Pinned threads never settle automatically, even after their pull request merges. Unpinning a thread
returns it to the usual settlement rules, and settling a pinned thread removes its pin.

On web and desktop, drag a thread between sections to change its state. Drag a thread up into
the pinned section to pin it at the spot you drop it; drag a pinned thread down into the active
list to unpin it. Dragging a thread onto the **Settled** header settles it, and dragging a settled
thread into the active list un-settles it. Dragging a thread into the **Parked** shelf parks it, and
dragging one out wakes it. To snooze until a set time, use **Snooze** from the thread's menu. Dragging a pinned thread out of the pinned section does not ask for unpin confirmation.
Pinned and active boundary labels appear only while dragging, without moving the rows. The
other rows slide aside to show where the thread will land. When you cross into another section,
the dragged thread shows the action the drop performs, with its icon: **Pin**, **Unpin**,
**Settle**, **Un-settle**, **Wake**, or **Park**. Its status and hover actions hide during the drag. A pinned
thread keeps its pin only while it stays in the pinned section; once it leaves, the badge takes
over. Reordering within the same section shows no badge. When there are no pins, drag to the top
edge to pin a thread. Section labels stay readable for the whole drag, and the section the
thread is over takes the accent color. Section labels also
identify empty sections and a collapsed settled shelf.

Drag within the pinned section to change its order. Other rows slide aside to show the spot where
the thread will land. On mobile, open a thread's menu and choose **Arrange threads**. Drag a
handle within **Pinned** to reorder, or between **Pinned** and **Active** to pin or unpin. Drop
onto the **Settled** divider to settle a thread. The dragged card shows the action before you
release it. Expand **Parked** or **Settled** to drag a thread back into either live
section. Each drop saves; **Done** returns to the thread list. The server saves the pinned order,
so it survives a refresh and appears on your other connected devices.

On web and desktop, the list also animates section changes made with thread actions such as
**Pin**, **Settle**, and **Snooze**. These transitions respect your system's reduced-motion
preference. While dragging, rows follow the insertion gap without replaying a second transition
after the drop.

The active list is ordered by when each thread last came back to you, with the most recent return
at the bottom, so you cannot drag or move threads within it. The settled shelf uses settlement
time, with the most recently settled threads at the bottom. **Show more** reveals older history above them.

If dragging is unavailable for one environment, update the Supacode server running in that
environment. Pinned reordering requires server support. Threads from older servers keep their
default order until the server is updated.

To generate a fresh title from the conversation, open a thread's menu and choose
**Regenerate title**. The action is unavailable while title generation is in progress
or when the connected environment needs a server update.

Agents connected through Supacode can use the same server-owned metadata workflow to
rename a thread, regenerate its title, or link and unlink a pull request. These changes
appear on web, desktop, and mobile without requiring the originating browser to remain
open.

### Working threads

Threads that are working or monitoring fold into a collapsed **Working** section. A thread
returns to the bottom of the active list when it finishes, fails, or needs an approval or answer.
The Working section places the thread you last sent work to at the bottom. Pinned threads stay
in the pinned section.

## Settle finished work

Choose **Settle thread** from its menu to move finished work out of the active list
without deleting the conversation. **Un-settle thread** restores it to active work
and prevents automatic settlement until new activity resumes the usual rules.
Manually settling an idle thread dismisses unanswered async questions without
sending an answer or restarting the agent. Settling also closes the thread's
terminals that wait at an idle prompt, and keeps their output. A terminal that
runs a command, such as a dev server, stays open.

To reclaim disk space from settled work, turn on **Run in the thread's worktree when the
thread settles** for one of the project's actions, or set `"runOnSettle": true` on a
`supacode.json` script, for example `cargo clean`. It runs each time a thread in its own
worktree settles, manually or automatically, even if a terminal there still runs a
command such as a dev server. Threads in the project's main checkout skip it. Its terminal
closes when the command succeeds and stays open when it fails.

On web and desktop, press a thread's **Settle** button and drag up or down to
settle every thread in that section between it and the one you release on.
The **Un-settle** and **Wake** buttons work the same way in their sections.
Press `Escape` while dragging to cancel.

By default, environments settle inactive threads after three days. Merged pull requests
settle their linked threads when **Auto-settle merged threads** is enabled. A closed pull request
can also settle an idle thread. Pins, work in progress, pending questions or approvals, and live background work
prevent automatic settlement. An open pull request does not prevent inactivity
settlement, but an old closed or merged pull request does not settle work you
resumed after it closed. Only your own messages count as resuming. A turn that
finished background work or a pull request watch starts on its own does not.

To keep one thread out of the settled shelf no matter how long it sits idle, open its menu,
choose **Auto-settle behavior**, and pick **Disabled**. The current option is checked. Pick
**Enabled** to return to the usual rules. Manual settle, snooze, and archive still work while it
is disabled.

Change these rules in **Settings → General** on web and desktop, or **Settings → Thread behavior** on mobile.
They continue to run when your apps are closed. On web and desktop, choose an environment at the
top to change only its rules, or **All environments** to update connected environments together.
Mixed values show where the selected environments disagree. Mobile applies these
rules to connected environments that support shared settings. Offline environments
and older servers keep their previous values. Changing a rule does not reopen
already settled threads.

## Link a pull request

The server finds the PR for each unsettled thread's saved branch, even when your
apps are closed. Settled threads keep their saved links. Update the server if
automatic branch links do not appear.

On web and desktop, right-click a pull request link in a thread and choose
**Link to thread** to select a different PR. Use **Unlink from thread** on the
same link to return to the branch PR, if one exists.
The linked pull request participates in automatic settlement.

## Find and reference work

On web and desktop, open the command palette with `Cmd/Ctrl+K`, or select
**Search** at the top of the sidebar, to search threads across connected
environments. Message search starts after two characters and includes your
messages and final agent responses.

Use **Settings → Keybindings** to find or customize shortcuts for searching files
and copying a thread reference. A copied reference uses the thread's pull request
link when available, otherwise its thread ID. See [keybindings](./keybindings.md)
for custom configuration.

## Inspect agent work

**Limited** means the provider stopped on a usage or rate limit. The conversation
keeps the provider's explanation. Retry after the limit resets, or switch to
another provider instance.
On web and desktop, press **Resume** in an empty composer to continue a limited
or interrupted turn manually.
Queued messages stay saved while the limit blocks the thread. They run after
the continuation finishes. If the queue was held by a restart, resume it then.

When the provider reports a reset time, choose **Resume at reset** to schedule a
continuation. You can cancel it from the thread. Enable **Auto-resume limited
threads** in **Settings → General** on web and desktop, or **Settings → Thread
behavior** on mobile, to schedule limit stops by default.
The environment must be running when the reset arrives; it resumes overdue
continuations after a restart. Sending a new message, archiving, or settling the
thread prevents a pending continuation from starting.

Choose **Snooze until reset** to hide the thread until its allowance returns.
Snooze and auto-resume are independent: snooze alone wakes the thread without
sending a message; enabling both wakes and continues it. **Wake now** cancels
the snooze. Enable **Snooze limited threads** in thread behavior settings to
snooze limit stops by default. Providers without a reset time offer manual
retry and the normal snooze choices.

On web and desktop, use **Agents** to follow work delegated to subagents.
Stop on a thread also stops the subagents it delegated to.

Subagent threads started by the agent can't take messages; message the parent
thread instead. When such a subagent needs an approval or an answer, the parent
thread asks for it.

Expand a tool call in the conversation to see its full command and output.
Summaries shorten shell wrappers and can still describe the latest call after it
finishes; the call's own result shows its status.

## Work side by side

On web and desktop, put as many threads on the stage as you like. Choose **Open beside** or
**Open below** from a thread's menu in the sidebar, or Option-click a thread (Option-Shift-click
for below). The focused pane is the one the address bar, shortcuts, and pasted text follow;
click a pane to focus it, or press `mod+alt+arrowright` and `mod+alt+arrowleft` to move between
panes. Clicking a thread in the sidebar shows it in the focused pane, or focuses the pane that
already shows it. While the stage is split, a new thread opens in its own pane beside the
focused one. Threads on the stage keep a light highlight in the sidebar. In the command
palette, press Option-Enter on a thread to open it beside.

You can also drag a thread from the sidebar onto the stage. Drop it near a pane's edge to open it
on that side, or in the middle to show it in that pane instead. To rearrange the stage, drag a
pane by the grip in its header onto another pane the same way; dropping in the middle swaps the
two. Flick a pane's grip downward to send it off the stage. Parking or settling a thread also
takes it off the stage. On a Force Touch trackpad, the trackpad gives a light tap as a dragged
thread or pane snaps to a drop zone, and a firmer one when you flick a pane off the stage.

To give one thread the whole stage, choose **Spotlight** in its header or press `mod+alt+s`.
While in Spotlight, moving to another pane spotlights that one instead; press `mod+alt+s` again
to bring every pane back. Close a pane with its **×** or `mod+alt+w`. On a split stage,
`mod+alt+enter` in a thread's pane sends your message and closes the pane in one step, and
sending from a new thread's pane swaps that pane for a fresh new thread. With a single thread,
both start a new thread. The stage is remembered when you reload.

When a new thread is alone on the stage, a quiet aquarium fills the space behind its composer.
The composer rests there as a bare text field; point at it, or press a composer shortcut such as
the model picker's, to bring back its project, branch, model, and access controls.
Each agent that is working, needs you, or has finished since you last looked swims there as a sea
creature, such as a fish, jellyfish, turtle, seahorse, or starfish, colored by its project. Point
at one to see which agent it is, and click it to open that thread in place of the new one. When an
agent needs you or finishes, its creature swims to the middle under a colored bubble. Closing the
last pane starts a new thread, so you land in the aquarium.

Click or tap empty water to drop a pellet, and hungry creatures nearby come to eat it. The dots at
the top right show how many pellets you have left, up to nine. Your agents earn more as they work,
and a few at once each time one finishes. A finishing agent's creature also drops a pearl in its
project's color; tap the pearl on the sand to add it to the strand at the top left. Drag through
the water to stir a current that sweeps nearby creatures along. Press and hold empty water to hatch
a clownfish of your own, and hold again to swap it for a shark, which is faster and scares
creatures from farther away. While your fish is out, dragging steers it instead of stirring.
Creatures scatter as it comes near, and one it catches vanishes in a puff of bubbles and swims back
in later. Tap your fish to send it away. Your pellets and strand last until you reload or restart the app. With reduced motion turned on, the creatures hold still and the
water ignores taps and drags.

Threads on the stage never cue you while the app is focused. Turn on toasts under **Settings →
General → Threads** to get a toast with **Bring on stage** when a thread off the stage finishes or
needs you. With system notifications on, the desktop app also bounces its Dock icon, or flashes
the taskbar button on Windows and Linux.

## Park or snooze for later

Choose **Park thread** from a thread's menu, or press `mod+alt+p` on web and desktop, to put
a thread away until you pick it back up. It moves to the **Parked** shelf and never settles on
its own. A thread that is still running finishes quietly and stays parked; an approval, a
question, or an error brings it back. Choose **Unpark thread**, or send it a message, to return
it to your active work.

To have a thread come back at a set time, choose **Snooze** and a time instead, or
**Snooze → Custom…** to pick a date and time in your local time zone, or a duration in
minutes, hours, or days. Durations start when you confirm; one day means 24 hours. Snoozed
threads wait in the **Parked** shelf with the time they return. Choose **Wake thread** to bring
one back early. On web and desktop, you can also park or snooze several selected threads together.

## Phase and project context

Choose **Phase** from a thread's menu to mark where the work stands: **Explore**, **Build**, or
**Ready**. Rows show the phase as three small bars, filled up to the current one. Agents can set
a thread's phase too.

To tell work apart at a glance, add contexts such as Work and Side under **Contexts** in
**Settings → General** on web and desktop. Then choose **Project context** from a thread's
menu, or set **Project context** in settings for one project or as an environment's default.
Every thread in that project shows the context's color in the sidebar.
