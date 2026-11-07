import graphene
import accounts.schema as acc
import apikeys.schema as keys
import billing.schema as bill
import messaging.schema as msg


class Query(acc.Query, keys.Query, bill.Query, bill.AdminQuery, msg.Query, graphene.ObjectType):
    pass


class Mutation(acc.Mutation, keys.Mutation, bill.Mutation, msg.Mutation, graphene.ObjectType):
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)
