import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, DynamicTable, EmptyState, Heading, Inline, Link, SectionMessage, Select, Spinner, Stack, Text, Textfield, User,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { DaysLozenge, actBy, formatDate, money } from './common.jsx';

const WINDOWS = [
  { label: 'Next 30 days', value: 30 },
  { label: 'Next 90 days', value: 90 },
  { label: 'Next 12 months', value: 365 },
  { label: 'All contracts', value: 100000 },
];

function inWindow(c, days) {
  if (days >= 100000) return c.state !== 'incomplete';
  if (c.state === 'closed') return true;
  if (c.state === 'act') return true;
  return (c.state === 'soon' || c.state === 'later') && c.daysLeft <= days;
}

function Owner({ owner }) {
  if (owner?.accountIds?.length) return <User accountId={owner.accountIds[0]} />;
  return <Text>{owner?.text || '—'}</Text>;
}

function ContractTable({ contracts }) {
  return (
    <DynamicTable
      head={{ cells: [
        { key: 'c', content: 'Contract' }, { key: 'o', content: 'Owner' }, { key: 'a', content: 'What to do' },
        { key: 'd', content: 'Time left' }, { key: 't', content: 'Term' }, { key: 'v', content: 'Annual value' },
      ] }}
      rows={contracts.map((c) => ({
        key: c.pageId,
        cells: [
          { key: 'c', content: <Link href={c.url}>{c.title}</Link> },
          { key: 'o', content: <Owner owner={c.owner} /> },
          { key: 'a', content: actBy(c) },
          { key: 'd', content: <DaysLozenge c={c} /> },
          { key: 't', content: c.auto ? `Renews ${formatDate(c.renewsOn)}` : c.termEnds ? `Ends ${formatDate(c.termEnds)}` : '—' },
          { key: 'v', content: c.value || '—' },
        ],
      }))}
    />
  );
}

function Tasks({ count, onDone }) {
  const [projectKey, setProjectKey] = useState('');
  const [state, setState] = useState(null);
  const run = async () => {
    setState({ busy: true });
    try {
      const r = await invoke('createTasks', { projectKey, withinDays: 30 });
      setState(r);
      if (r.ok) onDone();
    } catch (e) {
      setState({ ok: false, error: String(e) });
    }
  };
  const keys = (list) => list.map((t, i) => <Link key={t.key} href={`/browse/${t.key}`}>{`${t.key}${i < list.length - 1 ? ',' : ''}`}</Link>);
  return (
    <Stack space="space.100">
      <Heading size="small">Jira tasks</Heading>
      <Text>{`One task for each contract whose last day falls in the next 30 days (${count} now): assigned to the owner, due on that day and linked to the contract page. Running it again skips tasks that already exist.`}</Text>
      <Inline space="space.100" alignBlock="center">
        <Textfield name="project" placeholder="Jira project key" onChange={(e) => setProjectKey(e.target.value)} />
        <Button appearance="primary" isDisabled={!projectKey || count === 0 || state?.busy} onClick={run}>Create tasks</Button>
      </Inline>
      {state?.busy && <Spinner label="Creating tasks" />}
      {state && !state.busy && !state.ok && <SectionMessage appearance="error"><Text>{state.error}</Text></SectionMessage>}
      {state?.ok && (
        <SectionMessage appearance={state.failed.length ? 'warning' : 'success'}>
          {state.created.length > 0 && <Inline space="space.050"><Text>Created</Text>{keys(state.created)}</Inline>}
          {state.existing.length > 0 && <Inline space="space.050"><Text>Already there</Text>{keys(state.existing)}</Inline>}
          {state.failed.map((f) => <Text key={f.pageId}>{f.error}</Text>)}
          {state.created.length + state.existing.length + state.failed.length === 0 && <Text>No contract has its last day in the next 30 days.</Text>}
        </SectionMessage>
      )}
    </Stack>
  );
}

function Sample({ onDone }) {
  const [state, setState] = useState(null);
  const load = async () => {
    setState({ busy: true });
    const r = await invoke('loadSample').catch((e) => ({ ok: false, error: String(e) }));
    setState(r);
    if (r.ok) onDone();
  };
  return (
    <EmptyState
      header="No contract pages in this space yet"
      description="Notice Window reads pages that have a page properties table with Start date, Initial term, Renewal and Notice period rows. Load seven fictional contracts to see how it works."
      primaryAction={<Button appearance="primary" isDisabled={state?.busy} onClick={load}>{state?.busy ? 'Creating pages…' : 'Load sample contracts'}</Button>}
    />
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [windowDays, setWindowDays] = useState(WINDOWS[1]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    invoke('getSpaceData').then((d) => (d.error ? setError(d.error) : setData(d))).catch((e) => setError(String(e)));
  }, [version]);
  if (error) return <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Reading contract pages" />;
  const reload = () => { setData(null); setVersion((v) => v + 1); };
  if (data.contracts.length === 0) return <Sample onDone={reload} />;
  const act = data.contracts.filter((c) => c.state === 'act');
  const shown = data.contracts.filter((c) => inWindow(c, windowDays.value) && c.state !== 'incomplete');
  const incomplete = data.contracts.filter((c) => c.state === 'incomplete');
  const due30 = money(data.atStake30);
  return (
    <Stack space="space.250">
      <Text>{`${data.contracts.length} contract pages in this space, as of ${formatDate(data.today)}.`}</Text>
      {act.length > 0 ? (
        <SectionMessage appearance="warning" title={`${act.length} contract${act.length === 1 ? ' needs' : 's need'} action in the next 30 days`}>
          <Text>{due30 ? `${due30} of annual value has its last notice day in that time.` : 'Their last notice days fall in that time.'}</Text>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="success" title="Nothing due in the next 30 days" />
      )}
      <Inline space="space.100" alignBlock="center">
        <Text>Show</Text>
        <Select options={WINDOWS} value={windowDays} onChange={setWindowDays} />
      </Inline>
      <ContractTable contracts={shown} />
      {incomplete.length > 0 && (
        <Stack space="space.100">
          <Heading size="small">{`Pages to fix (${incomplete.length})`}</Heading>
          {incomplete.map((c) => (
            <Inline key={c.pageId} space="space.050"><Link href={c.url}>{c.title}</Link><Text>{c.findings.join(' ')}</Text></Inline>
          ))}
        </Stack>
      )}
      <Tasks count={act.length} onDone={() => {}} />
      <Text>Dates follow the common rule: notice must reach the other party at least the notice period before the last day of the term. Check the signed contract&apos;s own wording; this is not legal advice.</Text>
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
