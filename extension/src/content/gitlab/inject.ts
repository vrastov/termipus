export function inject(hostname: string): void {
  if (hostname.includes('gitlab.com')) {
    console.log('Termipus: initializing GitLab integration');
  }
}
