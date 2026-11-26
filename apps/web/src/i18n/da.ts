/**
 * Danish UI strings. Everything user-facing goes through this dictionary so an
 * English version can be added later without hunting through components.
 */
export const da = {
  appName: 'Produktionsplan',
  appTagline: 'Bogudgivelser',
  nav: {
    overview: 'Oversigt',
    publications: 'Udgivelser',
    myWork: 'Mine opgaver',
    masterplan: 'Masterplan',
  },
  comingSoon: 'Kommer snart',
  masterplan: {
    title: 'Masterplan',
    phases: 'faser',
    activities: 'aktiviteter',
    milestones: 'milepæle',
    defaultsNotice:
      'Varigheder, deadlines og afhængigheder er et forslag. De står ikke i den oprindelige masterplan og skal gennemgås med forlaget.',
    timelineTitle: 'Faseoverblik',
    timelineHint:
      'Nominel placering i forhold til udgivelsesdatoen (arbejdsdage, 1 md. ≈ 21 dage).',
    search: 'Søg i aktiviteter…',
    allRoles: 'Alle ansvarlige',
    expandAll: 'Fold alle ud',
    collapseAll: 'Fold alle sammen',
    noMatches: 'Ingen aktiviteter matcher filteret.',
    optional: 'Valgfri',
    columns: {
      activity: 'Aktivitet',
      responsible: 'Ansvarlig',
      duration: 'Varighed',
      deadline: 'Deadline',
      dependsOn: 'Afhænger af',
    },
    milestone: 'Milepæl',
    release: 'Udgivelse',
  },
} as const
