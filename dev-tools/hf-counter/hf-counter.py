import argparse
import base64
import http.client
import json
import time
import sys

# A small script that uses the BB REST API to count the number of commits
# (starting from an initial one) that exist on a branch
#
# In order to run the script locally you need to fill in the USERNAME nad PASSWORD variables
# The script needs the initial commit hash for a branch in order to count so make sure
# you add it to RELEASE_BRANCH_COMMITS if it isn't already there

RELEASE_BRANCH_COMMITS = {
    'rel-october23': '6ab4ef5',
    'rel-august23':  '60c6345',
    'rel-june23':    '2504819',
    'rel-april23':   '7318759',
    'rel-march23':   '6a37ff2',
}

# BB username (https://bitbucket.org/account/settings/)
USERNAME = ''.strip()
# BB app password (https://bitbucket.org/account/settings/app-passwords/)
# When you generate it, make sure you grant read permissions to the repository
PASSWORD = ''.strip()

AUTHORIZATION = base64.b64encode(f'{USERNAME}:{PASSWORD}'.encode()).decode('utf-8')
HEADERS = {
  'Authorization': f'Basic {AUTHORIZATION}',
  'Accept': 'application/json'
}

def commits_fetcher(branch):
  conn = http.client.HTTPSConnection('api.bitbucket.org')
  qparams = ''
  for _ in range(10):
    conn.request('GET', f'/2.0/repositories/bindersmedia/binders-service/commits/{branch}?{qparams}', '', HEADERS)
    res = conn.getresponse()
    data = res.read()
    if not data:
        print(f'Failed to fetch commit data. Status {res.status}, reason {res.reason}')
        raise Exception('Could not fetch any data')
    parsed_response = json.loads(data.decode('utf-8'))
    qparams = parsed_response['next'].split('?')[1]

    values = parsed_response['values']
    for value in values:
      yield value
  raise Exception('Reached maximum number of BB queries, double check your commit hash is exists on the branch')

def count_commits_for_branch(branch):
  commit_hash = RELEASE_BRANCH_COMMITS.get(branch)
  if commit_hash is None:
    raise Exception(f'Could not find a starting commit for branch {branch}. Please update the release commits map')

  count = 0
  for commit in commits_fetcher(branch):
    if commit['hash'].startswith(commit_hash):
      return count
    count += 1
    time.sleep(0.3)


if __name__ == '__main__':
  parser = argparse.ArgumentParser(prog='hf-counter', description='Counts the number of commits to a release branch')
  parser.add_argument('-b', '--branch', required=True)
  args = parser.parse_args()

  if not USERNAME or not PASSWORD:
    print('username and password must be set')
    sys.exit(1)

  release = args.branch
  count = count_commits_for_branch(release)
  print(f'Found {count} commits for branch {release}')
