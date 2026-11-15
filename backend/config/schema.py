import graphene
import accounts.schema as acc
import apikeys.schema as keys
import billing.schema as bill
import billing.orders_schema as orders
import messaging.schema as msg


class Query(acc.Query, keys.Query, bill.Query, bill.AdminQuery, orders.Query, orders.AdminQuery, msg.Query, graphene.ObjectType):
    pass


class Mutation(acc.Mutation, keys.Mutation, bill.Mutation, orders.Mutation, msg.Mutation, graphene.ObjectType):
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)
