/**
 * Feedbacks zusammenfassen — 3-Schritt-Wizard.
 * Steps: 1) Interaktion wählen → 2) Text aus Vorprompt, Feedbacks (Kürzel + Text) und Endprompt prüfen, bearbeiten, kopieren → 3) Zusammenfassung speichern.
 * Reads: interaktionen (Auswahl), feedbacks (der gewählten Interaktion). Writes: zusammenfassungen (über useFeedbacksZusammenfassenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useRef, useState } from 'react';
import { IconCopy, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, refFilter, useLiveList } from '@/lib/journey';
import type { JourneyRecord } from '@/lib/journey';
import { useFeedbacksZusammenfassenFlow } from '@/lib/journey/flows/FeedbacksZusammenfassen';
import type { FeedbacksZusammenfassenFlow } from '@/lib/journey/flows/FeedbacksZusammenfassen';
import { tx } from '@/i18n';

function composeText(interaktion: JourneyRecord | undefined, feedbacks: JourneyRecord[]): string {
  if (!interaktion) return '';
  const parts = [
    fieldText(interaktion, 'vorprompt').trim(),
    ...feedbacks.map(f => `${fieldText(f, 'kuerzel').trim()}: ${fieldText(f, 'feedback_text').trim()}`),
    fieldText(interaktion, 'endprompt').trim(),
  ];
  return parts.filter(p => p.length > 0).join('\n\n');
}

export default function FeedbacksZusammenfassenPage() {
  const [step, setStep] = useState(1);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // compute runs inside the flow hook, before `flow` exists — it reads the latest state through a ref
  const live = useRef<{ flow: FeedbacksZusammenfassenFlow | null; feedbacks: JourneyRecord[]; edited: string | null }>({
    flow: null, feedbacks: [], edited: null,
  });

  const flow = useFeedbacksZusammenfassenFlow({
    steps: { interaktion: 1 },
    items: {
      interaktion: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'frage') || tx('Ohne Frage'),
        subtitle: ctx.ref('veranstaltung'),
      }),
    },
    where: { interaktion: r => r.fields.aktiv === true },
    messages: { interaktion: tx('Bitte zuerst eine Interaktion wählen.') },
    compute: {
      zusammenfassung_text: forms => {
        const l = live.current;
        if (l.edited !== null) return l.edited;
        const id = forms.zusammenfassungen.get('interaktion') as string | null;
        return composeText(id ? l.flow?.picks.interaktion.recordOf(id) : undefined, l.feedbacks);
      },
    },
  });

  const interaktionId = (flow.forms.zusammenfassungen.get('interaktion') as string | null) ?? null;
  const feedbackList = useLiveList(flow.port, 'feedbacks', {
    intervalMs: 0,
    enabled: Boolean(interaktionId),
    list: interaktionId ? { filter: refFilter('interaktion', interaktionId), orderby: ['r.createdat asc'] } : undefined,
  });
  const feedbacks = interaktionId ? feedbackList.records : [];
  const interaktion = interaktionId ? flow.picks.interaktion.recordOf(interaktionId) : undefined;
  const composed = composeText(interaktion, feedbacks);
  const text = edited ?? composed;

  live.current = { flow, feedbacks, edited };

  useEffect(() => { setEdited(null); }, [interaktionId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <IntentWizardShell
      title={tx('Feedbacks zusammenfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Alle Feedbacks einer Interaktion zu einem Text für den Chatbot zusammenführen.'),
        needs: [tx('Eine aktive Interaktion')],
      }}
    >
      <WizardStep label={tx('Interaktion')} description={tx('Zu welcher Interaktion sollen die Feedbacks zusammengefasst werden?')}>
        <EntitySelectStep
          {...flow.picks.interaktion.select}
          {...flow.pick('interaktion')}
          searchPlaceholder={tx('Frage suchen …')}
          emptyText={tx('Keine aktive Interaktion vorhanden — setze zuerst eine Interaktion aktiv.')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep
        label={tx('Text')}
        description={tx('Vorprompt, Feedbacks mit Kürzel und Endprompt — bearbeite den Text und kopiere ihn.')}
        needs={['interaktion']}
      >
        <div className="space-y-3">
          {feedbackList.error && (
            <p className="text-sm text-destructive">{tx('Die Feedbacks konnten nicht geladen werden.')}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {feedbackList.loaded
              ? tx`${feedbacks.length} Feedbacks eingeflossen`
              : tx('Feedbacks werden geladen …')}
          </p>
          <Textarea
            value={text}
            onChange={e => setEdited(e.target.value)}
            rows={16}
            className="min-h-[50vh] w-full text-base"
            aria-label={tx('Text für den Chatbot')}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copy} disabled={!text}>
              {copied ? <IconCheck size={16} className="shrink-0" /> : <IconCopy size={16} className="shrink-0" />}
              <span>{copied ? tx('Kopiert') : tx('Text kopieren')}</span>
            </Button>
            {edited !== null && edited !== composed && (
              <Button type="button" variant="ghost" onClick={() => setEdited(null)}>
                {tx('Bearbeitung verwerfen')}
              </Button>
            )}
          </div>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              if (!flow.validateStep(1)) return false;
              if (!feedbackList.loaded) return tx('Die Feedbacks werden noch geladen.');
              if (!text.trim()) return tx('Der Text ist leer.');
              return true;
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'text', label: tx('Text für den Chatbot'), value: text, step: 2 }]}
            whatHappensNext={tx('Die Zusammenfassung wird gespeichert — danach kannst du die KI-Antwort ablegen.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('KI-Antwort ablegen'), href: '#/intents/ki-antwort-ablegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        >
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm">
            {fieldText(flow.submit.result.primary, 'zusammenfassung_text')}
          </pre>
        </SuccessStep>
      )}
    </IntentWizardShell>
  );
}
