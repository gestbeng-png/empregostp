import AccountActionLink, {
  AccountActionProvider,
} from '../auth/AccountActionLink';

export function CandidateActionProvider({ children }) {
  return <AccountActionProvider>{children}</AccountActionProvider>;
}

export default AccountActionLink;
