import { gsap } from "gsap";
import { createRevealMemory, type RevealMemory } from "./reveal-memory";
import { JOURNEY_PINNED_QUERY, REDUCED_QUERY, registerGsap } from "./choreography";

const FLOW_REVEAL_START = "top 88%";
const WORK_ROW_REVEAL_START = "top 90%";
const CONTACT_REVEAL_START = "top 95%";

type CreateAnimation = () => gsap.core.Animation;

function passedStart(trigger: HTMLElement, viewportPercent: number): boolean {
  return trigger.getBoundingClientRect().top <= window.innerHeight * viewportPercent;
}

/** Create a play-once reveal and remember its terminal visual state. */
function playOnce(
  memory: RevealMemory,
  identity: HTMLElement,
  create: CreateAnimation,
  settle: () => void
) {
  if (memory.hasCompleted(identity)) {
    settle();
    return;
  }
  const animation = create();
  animation.eventCallback("onComplete", () => memory.complete(identity));
}

/** Create a reversible reveal while preserving its terminal state on rebuild. */
function toggleReveal(
  memory: RevealMemory,
  identity: HTMLElement,
  trigger: HTMLElement,
  viewportPercent: number,
  create: CreateAnimation,
  settle: () => void
) {
  const wasCompleted = memory.hasCompleted(identity);
  if (wasCompleted && !passedStart(trigger, viewportPercent)) {
    // A rebuild can occur while the old animation is part-way through its
    // reverse. If the trigger is back before its start, rebuild from the hidden
    // state so the next forward entry behaves exactly as before.
    memory.reset(identity);
  }

  const animation = create();
  if (wasCompleted && passedStart(trigger, viewportPercent)) {
    // Recreate the ScrollTrigger so future leave-back events still reverse the
    // reveal, but restore its already-seen terminal frame without replaying it.
    animation.progress(1, true);
    settle();
  }
  animation.eventCallback("onComplete", () => memory.complete(identity));
  animation.eventCallback("onReverseComplete", () => memory.reset(identity));
}

function settleVisible(targets: HTMLElement[]) {
  if (targets.length) gsap.set(targets, { clearProps: "transform,opacity,visibility,clipPath" });
}

function setupFlowReveals(scope: HTMLElement, memory: RevealMemory) {
  const photo = scope.querySelector<HTMLElement>(".story-photo-box");
  const mask = scope.querySelector<HTMLElement>(".story-photo-mask");
  if (photo && mask) {
    playOnce(
      memory,
      mask,
      () => gsap.from(mask, {
        clipPath: "inset(100% 0% 0% 0%)",
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: { trigger: photo, start: "top 80%" },
      }),
      () => settleVisible([mask])
    );
  }

  const paragraphs = Array.from(scope.querySelectorAll<HTMLElement>(".story-copy p, .coda-text"));
  for (const paragraph of paragraphs) {
    playOnce(
      memory,
      paragraph,
      () => gsap.from(paragraph, {
        y: 40,
        autoAlpha: 0,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: paragraph, start: FLOW_REVEAL_START },
      }),
      () => settleVisible([paragraph])
    );
  }
}

function setupWorkRowReveals(scope: HTMLElement, memory: RevealMemory) {
  const rows = Array.from(scope.querySelectorAll<HTMLElement>(".work-row"));
  for (const row of rows) {
    const line = row.querySelector<HTMLElement>(".work-row-line");
    const copy = Array.from(row.querySelectorAll<HTMLElement>(".work-row-title, .work-row-meta span"));
    if (!line || !copy.length) continue;

    const settle = () => {
      gsap.set(line, { clearProps: "transform" });
      gsap.set(copy, { clearProps: "transform" });
    };
    toggleReveal(memory, row, row, 0.9, () => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: row,
          start: WORK_ROW_REVEAL_START,
          toggleActions: "play none none reverse",
        },
      });
      timeline
        .from(line, {
          scaleX: 0,
          transformOrigin: "0% 50%",
          duration: 1.3,
          ease: "expo.inOut",
        }, 0)
        .from(copy, {
          yPercent: 115,
          duration: 1.15,
          ease: "expo.out",
          stagger: 0.05,
        }, 0.12);
      return timeline;
    }, settle);
  }
}

function setupContactReveal(scope: HTMLElement, memory: RevealMemory) {
  const trigger = scope.querySelector<HTMLElement>(".contact-cta");
  if (!trigger) return;
  const targets = Array.from(scope.querySelectorAll<HTMLElement>(
    ".contact-cta-label, .contact-mail-text, .contact-mail-arrow, .contact-cta .contact-item, .contact-footer > *"
  ));
  if (!targets.length) return;

  const settle = () => settleVisible(targets);
  toggleReveal(memory, trigger, trigger, 0.95, () => {
    const timeline = gsap.timeline({
      defaults: { ease: "expo.out", duration: 1.3 },
      scrollTrigger: {
        trigger,
        start: CONTACT_REVEAL_START,
        toggleActions: "play none none reverse",
      },
    });
    timeline
      .fromTo(".contact-cta-label", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0 }, 0)
      .fromTo(".contact-mail-text", { yPercent: 110 }, { yPercent: 0 }, 0.06)
      .fromTo(".contact-mail-arrow", { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 1.1 }, 0.3)
      .fromTo(".contact-cta .contact-item, .contact-footer > *", { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, stagger: 0.06 }, 0.2);
    return timeline;
  }, settle);
}

/**
 * One-shot reveals live outside `setupChoreography`'s resize/language context.
 * Geometry-dependent scrubs and pins are still rebuilt there; a text-only
 * reveal does not need to be torn down and replayed for a new translation.
 */
export function setupReveals(scope: HTMLElement) {
  registerGsap();
  const memory = createRevealMemory();
  const motion = gsap.matchMedia(scope);
  const journeyLayout = gsap.matchMedia(scope);

  motion.add({ reduce: REDUCED_QUERY }, (context) => {
    const { reduce } = context.conditions as { reduce: boolean };
    if (reduce) return;
    setupWorkRowReveals(scope, memory);
    setupContactReveal(scope, memory);
  });

  journeyLayout.add(
    { reduce: REDUCED_QUERY, journeyPinned: JOURNEY_PINNED_QUERY },
    (context) => {
      const { reduce, journeyPinned } = context.conditions as { reduce: boolean; journeyPinned: boolean };
      if (reduce || journeyPinned) return;
      setupFlowReveals(scope, memory);
    }
  );

  return () => {
    journeyLayout.revert();
    motion.revert();
  };
}
