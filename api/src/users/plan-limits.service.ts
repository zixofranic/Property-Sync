import { Injectable } from '@nestjs/common';
import { Plan } from '@prisma/client';

export interface PlanLimits {
  clientLimit: number;
  propertyLimit: number;
  price: number; // in cents
  name: string;
  description: string;
}

@Injectable()
export class PlanLimitsService {
  private readonly planLimits: Record<Plan, PlanLimits> = {
    FREE: {
      clientLimit: 1,
      propertyLimit: 20,
      price: 0,
      name: 'Free',
      description: '1 client, up to 20 properties'
    },
    TIER_1: {
      clientLimit: 3,
      propertyLimit: 45,
      price: 1500, // $15.00
      name: 'Tier 1',
      description: '3 clients, up to 45 properties'
    },
    TIER_2: {
      clientLimit: 5,
      propertyLimit: 70,
      price: 2500, // $25.00
      name: 'Tier 2', 
      description: '5 clients, up to 70 properties'
    },
    ENTERPRISE: {
      clientLimit: 999,
      propertyLimit: 9999,
      price: 0, // Custom pricing
      name: 'Enterprise',
      description: 'Unlimited clients and properties'
    }
  };

  getLimitsForPlan(plan: Plan): PlanLimits {
    return this.planLimits[plan];
  }

  getAllPlans(): Array<{ plan: Plan; limits: PlanLimits }> {
    return Object.entries(this.planLimits).map(([plan, limits]) => ({
      plan: plan as Plan,
      limits
    }));
  }

  getRecommendedPlan(clientCount: number, propertyCount: number): Plan {
    // Find the cheapest plan that accommodates the usage
    const plans = this.getAllPlans().sort((a, b) => a.limits.price - b.limits.price);
    
    for (const { plan, limits } of plans) {
      if (clientCount <= limits.clientLimit && propertyCount <= limits.propertyLimit) {
        return plan;
      }
    }
    
    return 'ENTERPRISE'; // If no plan fits, recommend enterprise
  }

  validateUsageAgainstPlan(
    plan: Plan,
    currentClients: number,
    currentProperties: number,
    additionalClients = 0,
    additionalProperties = 0
  ): { 
    isValid: boolean; 
    clientExceeded: boolean; 
    propertyExceeded: boolean;
    limits: PlanLimits;
    usage: { clients: number; properties: number };
  } {
    const limits = this.getLimitsForPlan(plan);
    const totalClients = currentClients + additionalClients;
    const totalProperties = currentProperties + additionalProperties;
    
    const clientExceeded = totalClients > limits.clientLimit;
    const propertyExceeded = totalProperties > limits.propertyLimit;
    
    return {
      isValid: !clientExceeded && !propertyExceeded,
      clientExceeded,
      propertyExceeded,
      limits,
      usage: {
        clients: totalClients,
        properties: totalProperties
      }
    };
  }

  getUpgradeMessage(
    currentPlan: Plan,
    clientExceeded: boolean,
    propertyExceeded: boolean
  ): string {
    const recommendedPlan = this.getRecommendedPlan(
      clientExceeded ? 999 : 0,
      propertyExceeded ? 999 : 0
    );
    
    const limits = this.getLimitsForPlan(recommendedPlan);
    
    if (clientExceeded && propertyExceeded) {
      return `You've exceeded both client and property limits. Upgrade to ${limits.name} for ${limits.clientLimit} clients and ${limits.propertyLimit} properties.`;
    } else if (clientExceeded) {
      return `You've reached your client limit. Upgrade to ${limits.name} for ${limits.clientLimit} clients.`;
    } else if (propertyExceeded) {
      return `You've reached your property limit. Upgrade to ${limits.name} for ${limits.propertyLimit} properties.`;
    }
    
    return '';
  }
}