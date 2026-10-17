// The Mob's sections on /privacy and /terms (SOCIAL-SPEC P12: the privacy page explains the Mob in the same change that
// turns it on). Server components, plain words, every statement true of the code: what other members see and the
// default (src/lib/mob/compare.mjs, model.mjs buildView), the switch, leaving and blocking (mob_leave, mob_block),
// reports and their 180-day purge (api/internal/refresh-inventory), deletion (accountDeletion.js DELETION_STEPS).
// The pages render these only when MOB_ENABLED is 'true'.

export const mobEnabledForLegal = () => process.env.MOB_ENABLED === 'true';

export function MobPrivacySection() {
  return (
    <section id="mob">
      <h2>The Mob: studying with friends</h2>
      <p>A Mob is a private group of up to 5 students who sit the same 10-question paper each week. You can only join one through an invite link a member sends you. There is no Mob search, no member search, no chat, no messages, no photos, and MockMob never asks for your contacts.</p>
      <p><b>What the other members of your Mob see.</b> Your Mob display name (you choose it, 2 to 18 letters) and colour, and whether you sat each week&apos;s paper. Unless you turn sharing off: your score on each Mob paper, and for each question the option you picked, whether you changed your answer and how long you spent. Only the members of that same Mob see this. It is never shown to anyone else, never on a public page, and members are never ranked or sorted by score.</p>
      <p><b>Sharing is on by default, and you can turn it off.</b> On your Mob page, under Settings, turn off &quot;Share my score and answers with my Mob&quot;. From then on the other members see only that you sat, and you see their answers only while you share yours. You can turn it back on at any time. Some views always count the whole Mob without names, whatever your switch says: once 3 or more members sit a paper, members who sat it can see how many picked each option and the Mob&apos;s most common wrong answer.</p>
      <p><b>The invite page</b> shows the subject, how many seats are taken and when the link stops working, never anyone&apos;s name. A signed-in visitor also sees the display name of the member who made the link.</p>
      <p><b>Nudges.</b> After you sit, you can send one &quot;Sit it with me&quot; note a week to the members who have not sat. It carries your display name and no text. You are never told who has not sat.</p>
      <p><b>Leaving and blocking.</b> You can leave a Mob at any time; your membership and your sittings in that Mob are deleted when you leave. Leave and block also means you will never share a Mob with that person again. They are not told that you blocked them.</p>
      <p><b>Reporting.</b> You can report a member&apos;s name, their nudges, or anything that makes you feel unsafe. Moderators see the reason, the reported display name and the date, and can remove a member from a Mob. They are not shown who reported. Reports are deleted after 180 days.</p>
      <p><b>Deleting your account</b> removes all your Mob memberships, sittings, nudges and blocks, within 30 days of the request like the rest of your account. Reports you made or that name you lose any link to your account. Extra papers you made stay with the Mob, with no record of who made them.</p>
      <p><b>What we keep to run the Mob.</b> A note that you used your free Mob paper or your free side-by-side, so leaving and joining again cannot be used to get more; it is deleted with your account. We count Mob use only as totals across all Mobs (for example, how many papers were sat in a week), with groups under 5 never shown. No Mob activity is used for advertising.</p>
    </section>
  );
}

export function MobTermsSection() {
  return (
    <section id="mob">
      <h2>The Mob</h2>
      <p>The Mob lets you sit a weekly paper with up to 4 friends you invite. Use a display name that is not offensive and does not pretend to be MockMob or someone else. Do not use nudges or reports to harass anyone. Inside a Mob, members see each other&apos;s answers and scores unless they turn sharing off, as the <a href="/privacy#mob">Privacy Policy</a> explains. We may remove a member from a Mob, pause invites, or restrict the Mob for misuse.</p>
    </section>
  );
}
