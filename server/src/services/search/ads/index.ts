import {Types} from 'mongoose';

import {Ads, Ad} from '../../../models/ad';
import {BaseSearchQuery, SearchQueryResult, SearchQueryOptions} from '../base';

export type AdSearchQueryOptions = SearchQueryOptions<Ad> & {
  q?: string;
  tags?: string[] | string;
  vendorId?: string;
  from?: Date;
  to?: Date;
  sort?: 'date' | 'rate';
  sortOrder?: 1 | -1;
};

export class AdSearchQuery extends BaseSearchQuery<Ad, AdSearchQueryOptions> {
  protected static defaultOptions: AdSearchQueryOptions = {
    from: new Date('1980-01-01'),
    to: new Date('2040-01-01'),
    sort: 'date',
    sortOrder: -1,
    page: 0,
    limit: 10,
  };

  constructor(options_: AdSearchQueryOptions) {
    super(Object.assign({}, AdSearchQuery.defaultOptions, options_));
  }

  async exec(): Promise<SearchQueryResult<Ad>> {
    const aggregationPipeline = [];

    if (this.options_.q) {
      aggregationPipeline.push({
        $match: {
          $text: {
            $search: this.options_.q,
            $caseSensitive: false,
            $language: 'en',
          },
        },
      });
    }
    if (this.options_.vendorId) {
      aggregationPipeline.push({
        $match: {
          vendorId: new Types.ObjectId(this.options_.vendorId),
        },
      });
    }
    if (this.options_.tags) {
      aggregationPipeline.push({
        $match: {
          tags: {
            $in: Array.isArray(this.options_.tags)
              ? this.options_.tags
              : [this.options_.tags],
          },
        },
      });
    }

    aggregationPipeline.push({
      $match: {
        isDeleted: false,
        createdAt: {
          $gte: this.options_.from,
          $lt: this.options_.to,
        },
      },
    });

    const sortField = this.options_.sort === 'rate' ? 'likes' : 'createdAt';
    aggregationPipeline.push(
      {
        $sort: {
          [sortField]: this.options_.sortOrder,
        },
      },
      {
        $skip: this.options_.page! * this.options_.limit!,
      },
      {
        $limit: this.options_.limit!,
      }
    );

    if (this.options_.fields) {
      aggregationPipeline.push({
        $project: Object.fromEntries(this.options_.fields.map(el => [el, 1])),
      });
    }

    const res: Ad[] = await Ads.aggregate(aggregationPipeline).allowDiskUse(
      true
    );

    return {
      count: res.length,
      data: res,
    };
  }
}
