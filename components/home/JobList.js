import { FaSearch } from 'react-icons/fa';
import JobCard from '../JobCard';
import styles from '../../styles/JobList.module.css';

const JobList = ({ jobs = [] }) => {
  if (!jobs || jobs.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <FaSearch size={32} />
        </div>
        <h3 className={styles.emptyTitle}>Nenhuma vaga disponível no momento</h3>
        <p className={styles.emptyDescription}>
          Volte em breve para novas oportunidades de emprego.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.jobListGrid}>
      {jobs.slice(0, 12).map((vaga, index) => (
        <JobCard key={vaga.id || index} vaga={vaga} />
      ))}
    </div>
  );
};

export default JobList;
