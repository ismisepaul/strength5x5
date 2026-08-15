import { screen, within } from '@testing-library/react';

// The Train screen's start button reads "Start workout" on a train day and "Start
// anyway" on a rest day or an already-complete week (it's disabled and reads "Trained
// today" once the day is logged -- tests about that state match it exactly instead).
// Tests that only need to *begin* a session, or to assert the idle Train screen is
// showing, match either label so a fixture's dates shifting between those states doesn't
// break them.
export const START_BUTTON = /^Start (workout|anyway)$/;

// Starts a workout from the idle Train screen, clearing the "Train anyway?" confirmation
// when the fixture's dates make this an extra session. Most fixtures log their last
// session yesterday, which is exactly the rest-day case that gate covers, so tests that
// are really about what happens *after* the workout starts go through this rather than
// each re-deriving whether a confirmation is due.
export async function startWorkout(user) {
  await user.click(screen.getByText(START_BUTTON));
  const confirm = screen.queryByRole('dialog', { name: 'Train anyway?' });
  if (confirm) await user.click(within(confirm).getByText('Start anyway'));
}
