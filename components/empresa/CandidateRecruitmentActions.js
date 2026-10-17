import { ActionForm, InterviewControls, idPath } from './RecruitmentControls';
import styles from '../../styles/RecruitmentWorkspace.module.css';

/**
 * Only the candidate-safe timeline projection enters this component.
 * @param {{timeline: Record<string, any>, onSuccess?: (value: any) => void, request?: import('../../lib/apiClient').apiRequest}} props
 */
export default function CandidateRecruitmentActions({
  timeline,
  onSuccess,
  request,
}) {
  return (
    <div className={styles.root}>
      {timeline.interviews?.length ? (
        <section aria-label="Entrevistas do processo">
          <h4>Entrevistas</h4>
          {timeline.interviews.map((interview) => (
            <InterviewControls
              key={interview.id}
              candidate
              interview={interview}
              enabled={timeline.interviewsEnabled !== false}
              onSuccess={onSuccess}
              request={request}
            />
          ))}
        </section>
      ) : null}
      {timeline.hireConfirmation ? (
        <section
          className={styles.panel}
          aria-label="Confirmação de contratação"
        >
          <h4>{timeline.hireConfirmation.question}</h4>
          <ActionForm
            title="Confirmar início de trabalho"
            path={`/api/hires/${idPath(timeline.hireConfirmation.hireId)}/confirm`}
            onSuccess={onSuccess}
            request={request}
            fields={[
              {
                name: 'answer',
                label: 'Começou a trabalhar nesta organização?',
                options: [
                  ['CONFIRMED', 'Sim, comecei'],
                  [
                    'DISPUTED',
                    'Não, esta contratação não corresponde ao sucedido',
                  ],
                ],
              },
            ]}
            confirmText="Confirmo que esta resposta corresponde ao sucedido."
            submit="Enviar resposta"
          />
        </section>
      ) : null}
    </div>
  );
}
