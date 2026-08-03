import { TeamDetail } from '../../models/domain/team-detail.model';


export class TeamDetailAdapter {


  static adapt(response: any): TeamDetail {


    const team = response.team;


    return {

      id: Number(team.id),
      name: team.displayName,
      city: team.location,
      abbreviation: team.abbreviation,
      logo: team.logos?.[0]?.href ?? '',

      conference:
        team.standingSummary
          ?.includes('AFC')
            ? 'AFC'
            : 'NFC',

      division:
        team.standingSummary
          ?.replace(/^.*in /, '')
          ?? '',

      stadium:
        team.venue?.fullName
        ?? team.franchise?.venue?.fullName
        ?? '',

      record:
        team.record?.items?.[0]?.summary
        ?? '0-0',

      color:
        `#${team.color}`,

      alternateColor:
        `#${team.alternateColor}`


    };

  }

}