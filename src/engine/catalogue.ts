import type { Option, Priority, Rule, Scenario, Scores } from "./types";

const scores = (a: number, r: number, d: number, c: number): Scores =>
  ({ achievement: a, recovery: r, discovery: d, connection: c });
function option(id: string, label: string, description: string, values: Scores,
  reasons: [string, string, string, string], rules: Rule[] = [], requires?: string[]): Option {
  return { id, label, description, scores: values, rules, requires, rationale: {
    achievement: reasons[0], recovery: reasons[1], discovery: reasons[2], connection: reasons[3],
  } };
}
function rule(fact: string, equals: boolean, priority: Priority, delta: number, reason: string): Rule {
  return { fact, equals, changes: { [priority]: delta }, reason };
}

// These are authored value comparisons. Duration and context always come from the caller.
const entries: Scenario[] = [
  {
    id: "test-and-invitation", version: 1, title: "Test tomorrow, invitation tonight",
    summary: "Preparation and a social invitation compete for available time.",
    example: "My friend invited me out but I have an exam tomorrow.",
    routing: [["test", "exam", "revision"], ["friend", "invited", "party", "outing"]],
    questions: { prepared: "Is the necessary preparation already complete?", restorative: "Do you expect this outing to be restorative, based on your experience?" },
    options: [
      option("prepare", "Prepare", "Use the evening for remaining preparation.", scores(3, 1, 0, 0), ["Protects preparation time.", "Leaves control over the evening's pace.", "Does not explore the invitation.", "Leaves the invitation unanswered unless you communicate."], [rule("prepared", true, "achievement", -3, "You report that the necessary preparation is already complete.")]),
      option("attend", "Attend", "Attend the event; include any remaining work in the total time estimate.", scores(0, 0, 2, 3), ["Must still accommodate remaining preparation.", "The outing's effect on your energy is unknown.", "Makes room for an experience.", "Makes time for the invitation."], [rule("prepared", true, "achievement", 4, "Preparation is complete, so attending does not displace that work."), rule("restorative", true, "recovery", 3, "You describe this kind of outing as restorative.")]),
      option("brief", "Attend briefly", "Include travel, a shorter visit and remaining preparation in the estimate.", scores(2, 1, 1, 2), ["Reserves room for preparation if the complete plan fits.", "A shorter outing limits time committed.", "Tries a smaller version of the outing.", "Offers a bounded visit."], [], ["canLeaveEarly"]),
    ], reflection: "Did the plan fit, and what preparation actually got done?",
  },
  {
    id: "presentation-and-visit", version: 1, title: "Presentation and a friend's last day",
    summary: "A preparation deadline overlaps a limited opportunity to meet.", example: "My presentation is due soon and my friend leaves tomorrow.",
    routing: [["presentation", "presenting"], ["friend", "visit", "visitor"]],
    questions: { prepared: "Is the presentation already sufficiently prepared?", laterCapacity: "Have you confirmed enough later time to finish preparation?", visitAvailable: "Is the visit still available?" },
    options: [
      option("prepare", "Prepare now", "Prioritise the presentation today.", scores(3, 1, 0, 0), ["Advances remaining preparation.", "Avoids postponing the whole workload.", "Uses the current approach.", "May leave this meeting opportunity unused."], [rule("prepared", true, "achievement", -3, "The required preparation is already complete.")]),
      option("visit", "Protect the visit", "Meet now and account for the remaining preparation separately.", scores(0, 1, 1, 3), ["Needs sufficient later preparation capacity.", "Does not establish whether the meeting is restorative.", "Makes room for a different activity.", "Uses the available meeting opportunity."], [rule("laterCapacity", true, "achievement", 4, "You confirmed enough later capacity for preparation.")], ["visitAvailable"]),
      option("split", "Split today's time", "Combine a bounded visit and preparation, including travel.", scores(2, 0, 1, 2), ["Makes some preparation time explicit.", "Switching activities has a time cost.", "Tries a mixed plan.", "Includes time together."], [], ["visitAvailable"]),
    ], reflection: "How much preparation remained after the visit window closed?",
  },
  {
    id: "shift-and-coursework", version: 1, title: "Extra shift versus coursework",
    summary: "An optional shift competes with coursework.", example: "An extra shift clashes with my coursework.", routing: [["shift", "overtime"], ["coursework", "assignment", "essay"]],
    questions: { shiftEssential: "Have you identified the shift as an essential commitment?", swapApproved: "Has the shorter or swapped shift been approved?" },
    options: [
      option("work", "Accept the shift", "Include travel and remaining coursework in the plan.", scores(1, 0, 0, 2), ["Meets the offered work commitment.", "Adds a work commitment to the day.", "Uses the existing arrangement.", "Supports the workplace commitment."], [rule("shiftEssential", true, "achievement", 4, "You identify this shift as an essential commitment.")]),
      option("study", "Decline the extra shift", "Protect coursework time and communicate the decision.", scores(3, 2, 0, 1), ["Protects coursework time.", "Avoids adding the extra shift.", "Does not explore a different schedule.", "Makes availability clear."], [rule("shiftEssential", true, "achievement", -3, "Declining conflicts with the essential commitment you identified.")]),
      option("swap", "Request a shorter shift", "Compare the revised schedule only once approved.", scores(2, 1, 2, 2), ["Can preserve time for both obligations.", "Bounds the added workload.", "Explores a different schedule.", "Depends on agreement with the workplace."], [], ["swapApproved"]),
    ], reflection: "What schedule was agreed, and what work remained?",
  },
  {
    id: "hackathon-scope", version: 1, title: "New feature versus reliable demo",
    summary: "Novelty competes with stabilisation before judging.", example: "Should our hackathon team add a feature before judging?", routing: [["hackathon", "judging", "demo"], ["feature", "stabilise", "stabilize", "bug"]],
    questions: { demoBroken: "Is an essential demo step currently failing?", trialApproved: "Has the team agreed a trial checkpoint and fallback?" },
    options: [
      option("feature", "Build the feature", "Include implementation, integration and rehearsal time.", scores(1, 0, 3, 1), ["Adds scope before the deadline.", "Adds implementation work.", "Explores a new capability.", "Requires coordination with the team."], [rule("demoBroken", true, "achievement", -3, "An essential demo step still fails.")]),
      option("stabilise", "Stabilise the demo", "Fix existing failures and rehearse.", scores(3, 2, 0, 2), ["Protects demonstrable delivery.", "Limits added scope.", "Makes existing work available to show.", "Gives the team a shared rehearsal."], [rule("demoBroken", true, "discovery", 4, "Fixing the demo makes the existing novel work demonstrable.")]),
      option("trial", "Time-box a trial", "Stop at an agreed checkpoint with time left for the fallback.", scores(2, 1, 2, 2), ["Preserves a checkpoint for delivery.", "Bounds the experiment's duration.", "Tests a small version of the idea.", "Uses an agreed team checkpoint."], [], ["trialApproved"]),
    ], reflection: "Did the experiment meet its checkpoint, and was the demo ready?",
  },
  {
    id: "study-format", version: 1, title: "Study alone or with a group",
    summary: "Choose a study format for the actual task.", example: "Should I study alone or join my study group?", routing: [["study", "revise", "revision"], ["group", "alone", "solo"]],
    questions: { groupHelpful: "Have similar group sessions helped with this kind of task?", groupAvailable: "Is a suitable group session available?" },
    options: [
      option("solo", "Study alone", "Work independently on a defined task.", scores(3, 2, 0, 0), ["Protects independent task time.", "Allows control over pace.", "Uses your current understanding.", "Does not include a group session."], [rule("groupHelpful", false, "connection", 4, "You report this group format is unhelpful; a separate check-in can preserve contact.")]),
      option("group", "Join the group", "Use the group session for the task.", scores(1, 0, 3, 3), ["Task benefit depends on the group format.", "The social effort is not measured.", "Offers other explanations.", "Makes time for shared work."], [rule("groupHelpful", true, "achievement", 3, "You report that similar group sessions helped this task.")], ["groupAvailable"]),
      option("questions", "Prepare then ask questions", "Combine solo preparation and a bounded group session.", scores(2, 1, 2, 2), ["Identifies questions before the session.", "Bounds group time.", "Uses alternative explanations for specific gaps.", "Includes shared work."], [], ["groupAvailable"]),
    ], reflection: "What did you complete, and which format helped?",
  },
  {
    id: "new-tool", version: 1, title: "Familiar method or a new tool",
    summary: "Compare learning costs with the requirement.", example: "Should I learn a new tool for this project?", routing: [["tool", "framework", "software"], ["learn", "new", "familiar"]],
    questions: { familiarSufficient: "Can the familiar method meet the requirement?", fallbackFits: "Does the trial leave enough time for the fallback?" },
    options: [
      option("familiar", "Use the familiar method", "Complete the requirement with an established approach.", scores(3, 2, 0, 0), ["Uses an established workflow.", "Avoids adding setup work.", "Does not explore the new tool.", "No effect on time with other people is assumed."], [], ["familiarSufficient"]),
      option("new", "Learn the new tool", "Include learning and setup in the estimate.", scores(0, 0, 3, 0), ["Must include learning time before delivery.", "Adds unfamiliar work.", "Explores a new capability.", "No effect on time with other people is assumed."], [rule("familiarSufficient", false, "achievement", 4, "The familiar method cannot meet the requirement.")]),
      option("trial", "Try with a fallback", "Run a bounded trial before choosing the implementation.", scores(2, 1, 2, 0), ["Uses a checkpoint before committing.", "Bounds the initial experiment.", "Tests the new method.", "No effect on time with other people is assumed."], [], ["fallbackFits"]),
    ], reflection: "What did the trial establish about the requirement?",
  },
  {
    id: "help-moving", version: 1, title: "Help a friend move or finish work",
    summary: "A request for practical help overlaps personal work.", example: "My friend needs help moving but I have work to finish.", routing: [["moving", "move"], ["friend", "help"]],
    questions: { alreadyPromised: "Have you already promised to help?", boundedHelpUseful: "Would a shorter visit actually help with the move?" },
    options: [
      option("help", "Help with the move", "Account for the full task and travel.", scores(0, 0, 1, 3), ["Displaces some personal work time.", "Includes practical effort and travel.", "Offers a different activity.", "Provides the requested help."], [rule("alreadyPromised", true, "achievement", 4, "Helping fulfils a commitment you already made.")]),
      option("decline", "Decline clearly", "Protect work time and communicate availability.", scores(3, 2, 0, 1), ["Protects personal work.", "Avoids an added physical commitment.", "Does not explore another way to help.", "Avoids promising time you do not have."], [rule("alreadyPromised", false, "connection", 3, "There is no existing promise to break; clear boundaries are a valid relationship priority.")]),
      option("bounded", "Offer a useful bounded task", "Include a specific useful task and travel.", scores(2, 1, 2, 2), ["Bounds the time displaced from work.", "Limits the commitment.", "Finds another practical contribution.", "Provides some useful help."], [], ["boundedHelpUseful"]),
    ], reflection: "Was the offered help useful, and what work remained?",
  },
  {
    id: "drained-invitation", version: 1, title: "An invitation when feeling drained",
    summary: "Compare social contact with the user's own experience of rest.", example: "I feel drained but my friend invited me out.", routing: [["drained", "tired", "exhausted"], ["invited", "outing", "party", "social"]],
    questions: { restorative: "Does this kind of meeting usually feel restorative to you?", canLeaveEarly: "Can you leave early, including transport?" },
    options: [
      option("attend", "Attend", "Account for the whole outing.", scores(0, 0, 2, 3), ["Uses time that could serve other commitments.", "Its effect depends on your experience.", "Makes room for an experience.", "Makes time for contact."], [rule("restorative", true, "recovery", 4, "You describe this kind of meeting as restorative.")]),
      option("rest", "Decline and rest", "Protect uncommitted time and communicate the decision.", scores(1, 3, 0, 1), ["Keeps control of remaining commitments.", "Protects time you can use for rest.", "Leaves this outing unexplored.", "Makes your availability clear."], [rule("restorative", true, "recovery", -1, "Resting alone is not the only restorative option you identified.")]),
      option("short", "Choose a shorter meeting", "Include the shorter visit and transport.", scores(1, 2, 1, 2), ["Bounds the time commitment.", "Limits the outing's length.", "Tries a smaller format.", "Preserves some contact."], [], ["canLeaveEarly"]),
    ], reflection: "How did you feel afterwards, compared with your expectation?",
  },
  {
    id: "team-boundaries", version: 1, title: "Take on a teammate's work",
    summary: "Compare delivery, capacity and team commitments.", example: "My teammate wants me to take their work too.", routing: [["teammate", "team member"], ["work", "task", "part"]],
    questions: { spareCapacity: "Do you have capacity beyond your existing commitments?", redistributionApproved: "Has the team agreed to redistribution?" },
    options: [
      option("accept", "Take on the work", "Include your own remaining work in the estimate.", scores(2, 0, 1, 3), ["Adds another delivery commitment.", "Adds work to your schedule.", "May expose another part of the project.", "Helps the teammate with their request."], [rule("spareCapacity", false, "connection", -4, "Without spare capacity, accepting risks an unreliable commitment.")], ["spareCapacity"]),
      option("boundary", "Keep your current scope", "Explain your capacity and keep existing commitments.", scores(3, 3, 0, 1), ["Protects agreed delivery.", "Avoids adding workload.", "Keeps the current scope.", "Makes your capacity explicit."], [rule("spareCapacity", false, "connection", 3, "You report no spare capacity; an honest boundary protects reliability.")]),
      option("redistribute", "Redistribute or reduce scope", "Use a revised team plan once agreed.", scores(2, 2, 2, 2), ["Adjusts scope to available capacity.", "Can bound individual workload.", "Explores a different division of work.", "Requires shared agreement."], [], ["redistributionApproved"]),
    ], reflection: "What did the team agree, and was the commitment manageable?",
  },
  {
    id: "family-deadline", version: 1, title: "Family occasion and project deadline",
    summary: "A family occasion competes with project time.", example: "A family occasion overlaps my project deadline.", routing: [["family", "relative", "relatives", "parents", "siblings"], ["deadline", "project", "coursework", "assignment", "due", "work to finish", "finish work"]],
    questions: { prepared: "Is the required project work complete?", partialPossible: "Is partial attendance practical including travel?" },
    options: [
      option("attend", "Attend the occasion", "Include travel and any remaining project work.", scores(0, 0, 1, 3), ["Must account for remaining project work.", "Includes travel and attendance.", "Makes room for a different activity.", "Makes time for family contact."], [rule("prepared", true, "achievement", 4, "The required project work is already complete.")]),
      option("project", "Protect project time", "Prioritise remaining work and communicate the decision.", scores(3, 2, 0, 1), ["Protects remaining project work.", "Avoids the additional travel commitment.", "Uses the existing plan.", "Requires clear communication about attendance."], [rule("prepared", true, "achievement", -3, "The required work is already complete.")]),
      option("partial", "Attend part", "Include the real travel time and remaining work.", scores(2, 0, 1, 2), ["Splits available time across commitments.", "Travel still consumes time.", "Explores a different attendance format.", "Includes some family contact."], [], ["partialPossible"]),
    ], reflection: "Which trade-off mattered to you after the event?",
  },
  {
    id: "family-time", version: 1, title: "Making time for family",
    summary: "Compare spending time together now with arranging time together later.",
    example: "I want to spend time with family.",
    routing: [["family", "relative", "relatives", "parents", "siblings"]],
    questions: {
      availableNow: "Is your family available to spend time together now?",
      laterAgreed: "Have you agreed on a later time that works for everyone?",
    },
    options: [
      option("together", "Spend time together now", "Include time together and any travel.", scores(1, 0, 1, 3), ["Uses the time available now.", "You can agree on a pace that suits everyone.", "Makes room for a shared activity.", "Makes space for family time today."], [], ["availableNow"]),
      option("later", "Plan time together later", "Use this slot to organise a time that works for everyone.", scores(3, 2, 0, 1), ["Keeps the time together separate from this slot.", "Leaves more flexibility in your day.", "Gives you time to plan what to do together.", "A date in the diary gives everyone something concrete to plan around."], [rule("laterAgreed", true, "connection", 2, "You’ve agreed on a time that works for everyone.")]),
    ], reflection: "Did the plan make it easier to spend time together?",
  },
  {
    id: "scrolling-break", version: 1, title: "Scrolling break or next task",
    summary: "Compare a break and a next step using your context.", example: "I’m taking a scrolling break and deciding what to do next.", routing: [["scrolling", "scroll"], ["break", "task", "work"]],
    questions: { urgent: "Is there an immediate task deadline?", restorative: "Is this scrolling break helping you recharge?", socialConnection: "Is scrolling helping you connect with someone you care about?", alternativeRestorative: "Does the other break you have in mind usually help you recharge?" },
    options: [
      option("continue", "Keep scrolling for a while", "Choose how long you want the break to last.", scores(0, 0, 0, 0), ["Uses the time you choose for this break.", "Depends on whether it helps you recharge.", "No learning benefit is assumed.", "Connection depends on what you are doing online."], [rule("restorative", true, "recovery", 3, "You say this scrolling break helps you recharge."), rule("socialConnection", true, "connection", 3, "You say scrolling is helping you connect with someone you care about.")]),
      option("restart", "Start a small next task", "Make room for one defined next step.", scores(0, 0, 0, 0), ["Can serve the deadline you identify.", "No energy benefit is assumed.", "No learning benefit is assumed.", "No social benefit is assumed."], [rule("urgent", true, "achievement", 3, "You report an immediate task deadline.")]),
      option("different", "Choose another kind of break", "Compare a specific alternative break.", scores(0, 0, 0, 0), ["Uses the time you choose for another break.", "Depends on whether that break helps you recharge.", "A different activity is not automatically better.", "No social benefit is assumed."], [rule("alternativeRestorative", true, "recovery", 3, "You say the alternative break usually helps you recharge.")]),
    ], reflection: "Did the duration hold, and did the break feel useful?",
  },
  {
    id: "new-club", version: 1, title: "New club in a full week",
    summary: "Explore a recurring activity without hiding its time cost.", example: "I want to join a club but my week is packed.", routing: [["club", "society"], ["join", "week", "trial"]],
    questions: { replacementAvailable: "Have you identified an optional activity this would replace?", trialAvailable: "Is a trial available without an ongoing commitment?" },
    options: [
      option("join", "Join the club", "Estimate the recurring commitment for the same planning horizon.", scores(0, 0, 3, 3), ["Adds a recurring commitment.", "Needs room in the schedule.", "Explores a new activity.", "Makes room for a new group."], [rule("replacementAvailable", true, "recovery", 4, "You identified an optional activity to replace rather than simply adding more.")]),
      option("defer", "Defer joining", "Keep the current commitments for this period.", scores(3, 3, 0, 0), ["Protects existing commitments.", "Avoids adding recurring time.", "Defers the new activity.", "Defers joining the group."], []),
      option("trial", "Attend a trial", "Estimate the trial only; review recurring time before joining.", scores(1, 1, 2, 2), ["Delays the recurring decision until after a trial.", "Bounds the first commitment.", "Tests the activity.", "Meets the group."], [], ["trialAvailable"]),
    ], reflection: "Would joining be worth replacing another commitment?",
  },
  {
    id: "housemate-conversation", version: 1, title: "Raise a small housemate issue",
    summary: "Compare communication plans, not predicted reactions.", example: "My housemate leaves the kitchen messy and I want to talk.", routing: [["housemate", "roommate"], ["kitchen", "mess", "talk", "conversation"]],
    questions: { calmNow: "Is a calm conversation practical now?", laterAgreed: "Has a later conversation time been agreed?" },
    options: [
      option("talk", "Talk now", "Make a specific respectful request.", scores(3, 0, 1, 3), ["Raises the concrete issue.", "Requires attention now.", "Allows an exchange of perspectives.", "Creates an opportunity for direct communication."], [], ["calmNow"]),
      option("schedule", "Talk at an agreed time", "Prepare the request and use the agreed time.", scores(1, 3, 1, 1), ["Defers the conversation to a specific time.", "Allows preparation and a different moment.", "Uses a different timing.", "Keeps a concrete plan to communicate."], [rule("calmNow", false, "connection", 3, "A calmer agreed time can better serve respectful communication.")], ["laterAgreed"]),
      option("message", "Send a neutral request", "Describe the specific change wanted without predicting the response.", scores(2, 1, 2, 2), ["Makes the requested change explicit.", "Allows time to compose the request.", "Tries another communication format.", "Opens communication without assuming agreement."], []),
    ], reflection: "What response did you actually receive, if any?",
  },
  {
    id: "polish-or-submit", version: 1, title: "Polish or submit",
    summary: "Compare a specific improvement with completing submission.", example: "My assignment is finished but I keep polishing instead of submitting.", routing: [["assignment", "essay", "submission"], ["polish", "polishing", "submit", "submitting"]],
    questions: { requirementsMet: "Have the required checks passed?", specificImprovement: "Have you identified a specific useful improvement?" },
    options: [
      option("submit", "Check and submit", "Include final checks and upload time.", scores(2, 3, 0, 1), ["Completes the submission process.", "Ends the revision commitment.", "Does not try another revision.", "Releases time for other commitments."], [rule("requirementsMet", true, "achievement", 3, "You confirm the required checks passed.")], ["requirementsMet"]),
      option("polish", "Continue revising", "Include revision and upload time.", scores(3, 0, 2, 0), ["Can address a concrete remaining issue.", "Extends the work period.", "Explores another revision.", "Uses time otherwise available for commitments."], [rule("specificImprovement", false, "achievement", -3, "No specific useful improvement has been identified.")]),
      option("timebox", "Time-box one improvement", "Address one identified issue and leave time to upload.", scores(2, 1, 1, 1), ["Bounds one concrete revision.", "Limits further work.", "Tests one improvement.", "Sets a stopping point for other commitments."], [], ["specificImprovement"]),
    ], reflection: "Did extra work fix an identifiable issue?",
  },
  {
    id: "two-invitations", version: 1, title: "Two invitations, one evening",
    summary: "Compare invitations without ranking friendships.", example: "Two friends invited me to different events on the same evening.", routing: [["two", "both"], ["invitations", "invited", "events"]],
    questions: { promisedFirst: "Have you already committed to the first event?", splitPossible: "Do travel and useful attendance time permit both?" },
    options: [
      option("first", "Choose the first event", "Attend the first and communicate with the second host.", scores(1, 2, 0, 2), ["Makes one clear commitment.", "Avoids switching between events.", "Leaves the second event unexplored.", "Makes time for the first invitation."], [rule("promisedFirst", true, "connection", 3, "You already committed to the first event.")]),
      option("second", "Choose the second event", "Attend the second and communicate with the first host.", scores(1, 2, 2, 2), ["Makes one clear commitment.", "Avoids switching between events.", "Explores the alternative event.", "Makes time for the second invitation."], [rule("promisedFirst", true, "connection", -2, "This changes the commitment already made to the first event.")]),
      option("split", "Attend parts of both", "Include travel and minimum useful attendance at each.", scores(1, 0, 1, 3), ["Creates two bounded commitments.", "Includes extra travel and switching.", "Samples both events.", "Makes some time for both invitations."], [], ["splitPossible"]),
    ], reflection: "Did the plan match what mattered to you?",
  },
];

// Requirement questions are explicit even when an option introduced the requirement.
for (const scenario of entries) {
  for (const opt of scenario.options) {
    for (const fact of opt.requires ?? []) {
      if (!scenario.questions[fact]) scenario.questions[fact] =
        fact === "canLeaveEarly" ? "Can you leave early, including transport?" : `Can you confirm ${fact}?`;
    }
  }
}

/** Return copies so a caller cannot mutate the shared authored catalogue. */
export function listScenarios(): Scenario[] { return structuredClone(entries); }
export function getScenario(id: string): Scenario {
  const scenario = entries.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unsupported scenario: ${id}`);
  return structuredClone(scenario);
}
