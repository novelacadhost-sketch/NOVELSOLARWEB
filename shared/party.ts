/**
 * The staff end-of-year party: dates, choices and the rules an RSVP must meet.
 * Shared so the form and the server agree on every limit.
 */

export const PARTY_EVENT = 'eoy-2026'

export const PARTY = {
  name: 'End of Year Party 2026',
  partyDate: 'Saturday 19 December',
  startHour: 13,
  endHour: 22,
  matchDate: 'Sunday 20 December',
  matchTime: '2pm',
  apartment: 'Lane 4',
} as const

export const MAX_ADULT_GUESTS = 10
export const MAX_CHILDREN = 10

export const LANE4_STAYS = {
  fri_sat: 'Friday to Saturday',
  fri_sun: 'Friday to Sunday',
} as const
export type Lane4Stay = keyof typeof LANE4_STAYS

export interface PartyChild {
  age: number
}

export interface PartyRsvp {
  attending: boolean
  adultGuests: number
  children: PartyChild[]
  arriveHour: number | null
  leaveHour: number | null
  noveltyMatch: boolean
  lane4Stay: Lane4Stay | null
}

/** 13 -> "1pm", 22 -> "10pm". */
export function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? 'am' : 'pm'}`
}

function wholeNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Checks a submitted RSVP and returns it in the stored shape, or the reason it
 * cannot be saved, written for the person filling in the form. Someone not
 * coming has everything else cleared, so a change of mind leaves no stale
 * guests behind.
 */
export function parsePartyRsvp(input: unknown): { rsvp: PartyRsvp } | { error: string } {
  const body = (input ?? {}) as Record<string, unknown>
  if (typeof body.attending !== 'boolean') return { error: 'Please say whether you are coming.' }

  if (!body.attending) {
    return {
      rsvp: {
        attending: false,
        adultGuests: 0,
        children: [],
        arriveHour: null,
        leaveHour: null,
        noveltyMatch: false,
        lane4Stay: null,
      },
    }
  }

  const adultGuests = wholeNumber(body.adultGuests ?? 0, 0, MAX_ADULT_GUESTS)
  if (adultGuests === null) return { error: `Adult guests must be a number from 0 to ${MAX_ADULT_GUESTS}.` }

  const rawChildren = Array.isArray(body.children) ? body.children : []
  if (!Array.isArray(body.children ?? []) || rawChildren.length > MAX_CHILDREN) {
    return { error: `You can register up to ${MAX_CHILDREN} children.` }
  }
  const children: PartyChild[] = []
  for (const child of rawChildren) {
    const age = wholeNumber((child as Record<string, unknown> | null)?.age, 0, 17)
    if (age === null) return { error: "Please give each child's age (0 to 17)." }
    children.push({ age })
  }

  const arriveHour = wholeNumber(body.arriveHour, PARTY.startHour, PARTY.endHour - 1)
  const leaveHour = wholeNumber(body.leaveHour, PARTY.startHour + 1, PARTY.endHour)
  if (arriveHour === null || leaveHour === null || arriveHour >= leaveHour) {
    return {
      error: `Please choose when you will arrive and leave, between ${hourLabel(PARTY.startHour)} and ${hourLabel(PARTY.endHour)}.`,
    }
  }

  const lane4Stay = body.lane4Stay ?? null
  if (lane4Stay !== null && !(typeof lane4Stay === 'string' && lane4Stay in LANE4_STAYS)) {
    return { error: `Please choose how long you will stay at ${PARTY.apartment}.` }
  }

  return {
    rsvp: {
      attending: true,
      adultGuests,
      children,
      arriveHour,
      leaveHour,
      noveltyMatch: body.noveltyMatch === true,
      lane4Stay: lane4Stay as Lane4Stay | null,
    },
  }
}
